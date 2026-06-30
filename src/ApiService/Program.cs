using ApiService.Data;
using ApiService.Endpoints;
using ApiService.Hubs;
using ApiService.Services;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// ── Database ────────────────────────────────────────────────────────────
builder.AddNpgsqlDbContext<JarvisDbContext>("javisdb");

// ── Ollama (gemma3:12b) → IChatClient via Microsoft.Extensions.AI ───────
builder.AddOllamaApiClient("jarvis-llm").AddChatClient();

// ── Whisper (STT) ───────────────────────────────────────────────────────
builder.Services.AddSingleton<WhisperService>();

// ── TTS Proxy (Aspire service discovery → https://tts) ──────────────────
builder.Services.AddHttpClient<TtsProxy>(c =>
{
    c.BaseAddress = new Uri("https://tts");
    c.Timeout = System.Threading.Timeout.InfiniteTimeSpan;
})
.AddStandardResilienceHandler(options =>
{
    options.AttemptTimeout.Timeout = TimeSpan.FromMinutes(5);
    options.TotalRequestTimeout.Timeout = TimeSpan.FromMinutes(5);
    options.CircuitBreaker.SamplingDuration = TimeSpan.FromMinutes(10);
});

// ── Settings & Orchestrator ─────────────────────────────────────────────
builder.Services.AddSingleton<CommandParser>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<JarvisOrchestrator>();

// ── SignalR ─────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── CORS for Angular dev server ─────────────────────────────────────────
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.SetIsOriginAllowed(_ => true)
     .AllowAnyHeader()
     .AllowAnyMethod()
     .AllowCredentials()));

builder.Services.AddProblemDetails();

var app = builder.Build();

// ── Startup: ensure default settings + Whisper model ready ─────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<JarvisDbContext>();
    await db.Database.EnsureCreatedAsync();

    var settings = scope.ServiceProvider.GetRequiredService<SettingsService>();
    await settings.EnsureDefaultsAsync();

    // Eagerly initialize Whisper (downloads model if needed)
    var stt = scope.ServiceProvider.GetRequiredService<WhisperService>();
    _ = stt.ModelPath; // triggers lazy init
}

app.UseExceptionHandler();
app.UseStaticFiles();
app.UseCors();
app.UseRouting();

app.MapDefaultEndpoints();
app.MapTranscribe();
app.MapChat();
app.MapSpeak();
app.MapVoices();
app.MapSettings();
app.MapHub<JarvisHub>("/hubs/jarvis");

app.Run();

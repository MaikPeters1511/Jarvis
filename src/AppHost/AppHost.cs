using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// ── PostgreSQL ───────────────────────────────────────────────────────────
var pg = builder.AddPostgres("postgres")
    .WithDataVolume()
    .WithPgAdmin(c => c.WithHostPort(5050));
var db = pg.AddDatabase("javisdb");

// ── Ollama + Gemma 3 4B (lokal, Aspire-managed Model-Download) ──────────
var ollama = builder.AddOllama("ollama")
    .WithDataVolume();
var llm = ollama.AddModel("jarvis-llm", "gemma3:4b");

// ── Qwen3-TTS Python Service (FastAPI) ───────────────────────────────────
var tts = builder.AddUvicornApp("tts", "../TtsService", "main:app")
    .WithUv()
    .WithReference(db)
    .WithHttpEndpoint(port: 8000)
    .WithEnvironment("QWEN_TTS_BASE_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
    .WithEnvironment("QWEN_TTS_DEVICE", "mps")
    .WithEnvironment("QWEN_TTS_DTYPE", "bfloat16");

// ── .NET API Service ─────────────────────────────────────────────────────
var api = builder.AddProject<Projects.ApiService>("api")
    .WithHttpEndpoint(port: 5180)
    .WithReference(llm).WaitFor(llm)
    .WithReference(tts).WaitFor(tts)
    .WithReference(db).WaitFor(db)
    .WithExternalHttpEndpoints();

// ── Angular Web App ──────────────────────────────────────────────────────
var web = builder.AddJavaScriptApp("web", "../Web", "start")
    .WithReference(api)
    .WithHttpEndpoint(targetPort: 4200)
    .WithExternalHttpEndpoints();

builder.Build().Run();

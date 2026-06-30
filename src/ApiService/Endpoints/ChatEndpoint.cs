using ApiService.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;

namespace ApiService.Endpoints;

public static class ChatEndpoint
{
    public record ChatRequest(string Text, string? SystemPromptOverride = null);

    public static void MapChat(this IEndpointRouteBuilder app)
    {
        // Streaming SSE chat (text only, no TTS)
        app.MapPost("/api/chat", async (
            [FromBody] ChatRequest request,
            IChatClient chat,
            CommandParser commandParser,
            SettingsService settings,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Text))
                return Results.BadRequest(new { error = "text is required" });

            if (commandParser.TryHandleCommand(request.Text, out var commandAnswer))
            {
                async IAsyncEnumerable<ChatChunk> GenerateFixedResponse()
                {
                    yield return new ChatChunk(commandAnswer);
                    await Task.CompletedTask;
                }
                return Results.ServerSentEvents(GenerateFixedResponse());
            }

            var systemPrompt = request.SystemPromptOverride
                ?? await settings.GetAsync(SettingsService.KeyLlmSystemPrompt, ct);
            var temperature = float.Parse(await settings.GetAsync(SettingsService.KeyLlmTemperature, ct), System.Globalization.CultureInfo.InvariantCulture);
            var topP = float.Parse(await settings.GetAsync(SettingsService.KeyLlmTopP, ct), System.Globalization.CultureInfo.InvariantCulture);
            var maxTokens = int.Parse(await settings.GetAsync(SettingsService.KeyLlmMaxTokens, ct));

            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, systemPrompt),
                new(ChatRole.User, request.Text)
            };

            return Results.ServerSentEvents(GenerateChatStream(chat, messages, temperature, topP, maxTokens, ct));
        })
        .WithName("Chat");

        // Full pipeline: audio in → audio out (STT → LLM → TTS)
        app.MapPost("/api/pipeline", async (
            [FromForm] IFormFile audio,
            [FromForm] string? voiceId,
            JarvisOrchestrator orchestrator,
            CancellationToken ct) =>
        {
            if (audio is null || audio.Length == 0)
                return Results.BadRequest(new { error = "audio is required" });

            await using var stream = audio.OpenReadStream();
            var result = await orchestrator.ProcessAudioAsync(stream, voiceId, ct);
            // Note: result.Audio must be disposed by the caller
            return Results.Stream(result.Audio, "audio/wav");
        })
        .WithName("Pipeline")
        .DisableAntiforgery()
        .Accepts<IFormFile>("multipart/form-data")
        .Produces(200, contentType: "audio/wav");
    }

    private static async IAsyncEnumerable<ChatChunk> GenerateChatStream(
        IChatClient chat,
        List<ChatMessage> messages,
        float temperature,
        float topP,
        int maxTokens,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        await foreach (var update in chat.GetStreamingResponseAsync(
            messages,
            new ChatOptions
            {
                Temperature = temperature,
                TopP = topP,
                MaxOutputTokens = maxTokens,
            },
            ct))
        {
            if (!string.IsNullOrEmpty(update.Text))
            {
                yield return new ChatChunk(update.Text);
            }
        }
    }

    public record ChatChunk(string Text);
}

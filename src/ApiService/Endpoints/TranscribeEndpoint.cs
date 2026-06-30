using ApiService.Services;
using Microsoft.AspNetCore.Mvc;

namespace ApiService.Endpoints;

public static class TranscribeEndpoint
{
    public static void MapTranscribe(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/transcribe", async (
            [FromForm] IFormFile audio,
            JarvisOrchestrator orchestrator,
            CancellationToken ct) =>
        {
            if (audio is null || audio.Length == 0)
                return Results.BadRequest(new { error = "No audio file" });

            await using var stream = audio.OpenReadStream();
            var text = await orchestrator.TranscribeOnlyAsync(stream, ct);
            return Results.Ok(new { text });
        })
        .WithName("Transcribe")
        .DisableAntiforgery()
        .WithSummary("Transcribe audio to text (Whisper Base)")
        .Accepts<IFormFile>("multipart/form-data");
    }
}

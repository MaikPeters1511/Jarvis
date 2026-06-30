using ApiService.Services;
using Microsoft.AspNetCore.Mvc;

namespace ApiService.Endpoints;

public static class SpeakEndpoint
{
    public record SpeakRequest(string Text, string? VoiceId = null, string? Language = null);

    public static void MapSpeak(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/speak", async (
            [FromBody] SpeakRequest request,
            JarvisOrchestrator orchestrator,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Text))
                return Results.BadRequest(new { error = "text is required" });

            var audio = await orchestrator.SpeakTextAsync(request.Text, request.VoiceId, ct);
            return Results.Stream(audio, "audio/wav");
        })
        .WithName("Speak")
        .Produces(200, contentType: "audio/wav");
    }
}

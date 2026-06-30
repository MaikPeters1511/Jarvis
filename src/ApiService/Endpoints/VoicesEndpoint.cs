using ApiService.Services;
using Microsoft.AspNetCore.Mvc;

namespace ApiService.Endpoints;

public static class VoicesEndpoint
{
    public static void MapVoices(this IEndpointRouteBuilder app)
    {
        // List all voices
        app.MapGet("/api/voices", async (TtsProxy tts, CancellationToken ct) =>
        {
            var voices = await tts.ListVoicesAsync(ct);
            return Results.Ok(voices);
        })
        .WithName("ListVoices");

        // Upload a new reference voice
        app.MapPost("/api/voices", async (
            [FromForm] string name,
            [FromForm] string refText,
            [FromForm] string language,
            IFormFile file,
            TtsProxy tts,
            CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
                return Results.BadRequest(new { error = "audio file is required" });
            if (string.IsNullOrWhiteSpace(refText))
                return Results.BadRequest(new { error = "refText is required for voice cloning" });
            if (string.IsNullOrWhiteSpace(name))
                return Results.BadRequest(new { error = "name is required" });

            await using var stream = file.OpenReadStream();
            var voice = await tts.UploadVoiceAsync(name, refText, language, stream, file.FileName, ct);
            return Results.Created($"/api/voices/{voice.Id}", voice);
        })
        .WithName("UploadVoice")
        .DisableAntiforgery()
        .Accepts<IFormFile>("multipart/form-data");

        // Delete a voice
        app.MapDelete("/api/voices/{id}", async (string id, TtsProxy tts, CancellationToken ct) =>
        {
            try
            {
                await tts.DeleteVoiceAsync(id, ct);
                return Results.NoContent();
            }
            catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return Results.NotFound();
            }
        })
        .WithName("DeleteVoice");
    }
}

using ApiService.Services;
using Microsoft.AspNetCore.Mvc;

namespace ApiService.Endpoints;

public static class SettingsEndpoint
{
    public static void MapSettings(this IEndpointRouteBuilder app)
    {
        // Get all settings
        app.MapGet("/api/settings", async (SettingsService settings, CancellationToken ct) =>
        {
            var all = await settings.GetAllAsync(ct);
            return Results.Ok(all);
        })
        .WithName("GetSettings");

        // Get a single setting
        app.MapGet("/api/settings/{key}", async (string key, SettingsService settings, CancellationToken ct) =>
        {
            var value = await settings.GetAsync(key, ct);
            return Results.Ok(new { key, value });
        })
        .WithName("GetSetting");

        // Update a single setting
        app.MapPut("/api/settings/{key}", async (
            string key,
            [FromBody] SettingUpdate body,
            SettingsService settings,
            CancellationToken ct) =>
        {
            await settings.SetAsync(key, body.Value ?? "", ct);
            return Results.Ok(new { key, value = body.Value });
        })
        .WithName("UpdateSetting");

        // Bulk update
        app.MapPut("/api/settings", async (
            [FromBody] Dictionary<string, string> updates,
            SettingsService settings,
            CancellationToken ct) =>
        {
            foreach (var (k, v) in updates)
            {
                await settings.SetAsync(k, v, ct);
            }
            return Results.Ok(await settings.GetAllAsync(ct));
        })
        .WithName("BulkUpdateSettings");
    }

    public record SettingUpdate(string? Value);
}

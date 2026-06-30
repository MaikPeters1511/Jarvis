using ApiService.Data;
using ApiService.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ApiService.Services;

/// <summary>
/// Centralized access to runtime settings, stored in Postgres.
/// </summary>
public class SettingsService(JarvisDbContext db)
{
    public const string KeyLlmSystemPrompt = "llm.system_prompt";
    public const string KeyLlmTemperature = "llm.temperature";
    public const string KeyLlmMaxTokens = "llm.max_tokens";
    public const string KeyLlmTopP = "llm.top_p";

    public const string KeyTtsDefaultVoiceId = "tts.default_voice_id";
    public const string KeyTtsTemperature = "tts.temperature";
    public const string KeyTtsTopP = "tts.top_p";
    public const string KeyTtsTopK = "tts.top_k";
    public const string KeyTtsRepetitionPenalty = "tts.repetition_penalty";
    public const string KeyTtsMaxTokens = "tts.max_tokens";
    public const string KeyTtsLanguage = "tts.language";

    public const string KeySttLanguage = "stt.language";
    public const string KeySttSilenceMs = "stt.silence_ms";
    public const string KeySttSilenceThreshold = "stt.silence_threshold";

    public const string KeyWakewordThreshold = "wakeword.threshold";
    public const string KeyWakewordCooldownMs = "wakeword.cooldown_ms";

    public const string KeyTheme = "ui.theme";

    public const string DefaultLlmSystemPrompt =
        "Du bist Javis, ein hilfsbereiter und freundlicher Sprachassistent. " +
        "Antworte immer auf Deutsch, prägnant und natürlich. " +
        "Halte deine Antworten kurz genug, um sie in 2-3 Sätzen vorlesen zu können.";

    private static readonly Dictionary<string, string> Defaults = new()
    {
        [KeyLlmSystemPrompt] = DefaultLlmSystemPrompt,
        [KeyLlmTemperature] = "0.7",
        [KeyLlmMaxTokens] = "512",
        [KeyLlmTopP] = "0.9",
        [KeyTtsTemperature] = "0.9",
        [KeyTtsTopP] = "1.0",
        [KeyTtsTopK] = "50",
        [KeyTtsRepetitionPenalty] = "1.05",
        [KeyTtsMaxTokens] = "2048",
        [KeyTtsLanguage] = "Auto",
        [KeySttLanguage] = "auto",
        [KeySttSilenceMs] = "1500",
        [KeySttSilenceThreshold] = "0.015",
        [KeyWakewordThreshold] = "0.5",
        [KeyWakewordCooldownMs] = "2000",
        [KeyTheme] = "dark",
    };

    /// <summary>
    /// Ensure all default settings exist in DB.
    /// </summary>
    public async Task EnsureDefaultsAsync(CancellationToken ct = default)
    {
        var existing = await db.Settings.Select(s => s.Key).ToListAsync(ct);
        var missing = Defaults.Keys.Except(existing).ToList();
        if (missing.Count == 0) return;

        foreach (var key in missing)
        {
            db.Settings.Add(new JarvisSetting
            {
                Key = key,
                Value = Defaults[key],
                UpdatedAt = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<string> GetAsync(string key, CancellationToken ct = default)
    {
        var s = await db.Settings.FindAsync([key], ct);
        return s?.Value ?? Defaults.GetValueOrDefault(key, "");
    }

    public async Task SetAsync(string key, string value, CancellationToken ct = default)
    {
        var s = await db.Settings.FindAsync([key], ct);
        if (s is null)
        {
            db.Settings.Add(new JarvisSetting { Key = key, Value = value });
        }
        else
        {
            s.Value = value;
            s.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<Dictionary<string, string>> GetAllAsync(CancellationToken ct = default)
    {
        var stored = await db.Settings.ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        // Merge with defaults
        var result = new Dictionary<string, string>(Defaults);
        foreach (var (k, v) in stored) result[k] = v;
        return result;
    }
}

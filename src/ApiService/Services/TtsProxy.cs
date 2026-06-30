using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace ApiService.Services;

public record TtsRequest(
    [property: JsonPropertyName("text")] string Text,
    [property: JsonPropertyName("language")] string Language = "Auto",
    [property: JsonPropertyName("ref_audio_id")] string? RefAudioId = null,
    [property: JsonPropertyName("ref_text")] string? RefText = null,
    [property: JsonPropertyName("temperature")] double Temperature = 0.9,
    [property: JsonPropertyName("top_p")] double TopP = 1.0,
    [property: JsonPropertyName("top_k")] int TopK = 50,
    [property: JsonPropertyName("max_tokens")] int MaxTokens = 2048,
    [property: JsonPropertyName("repetition_penalty")] double RepetitionPenalty = 1.05
);

public record TtsVoice(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("language")] string Language,
    [property: JsonPropertyName("ref_text")] string RefText,
    [property: JsonPropertyName("filename")] string Filename,
    [property: JsonPropertyName("size_bytes")] long SizeBytes,
    [property: JsonPropertyName("created_at")] DateTime CreatedAt
);

/// <summary>
/// HTTP client proxy for the Qwen3-TTS Python service.
/// Uses Aspire service discovery ("https://tts" resolves via DNS).
/// </summary>
public class TtsProxy(HttpClient http, ILogger<TtsProxy> logger)
{
    public async Task<Stream> SynthesizeAsync(TtsRequest request, CancellationToken ct = default)
    {
        logger.LogInformation("TTS request: {Chars} chars, voice={Voice}, lang={Lang}",
            request.Text.Length, request.RefAudioId ?? "(none)", request.Language);

        var response = await http.PostAsJsonAsync("/synthesize", request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStreamAsync(ct);
    }

    public async Task<IReadOnlyList<TtsVoice>> ListVoicesAsync(CancellationToken ct = default)
    {
        try
        {
            var voices = await http.GetFromJsonAsync<List<TtsVoice>>("/voices", ct);
            return voices ?? new List<TtsVoice>();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to list voices from TTS service");
            return Array.Empty<TtsVoice>();
        }
    }

    public async Task<TtsVoice> UploadVoiceAsync(
        string name, string refText, string language, Stream audioStream, string fileName, CancellationToken ct = default)
    {
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(name), "name");
        form.Add(new StringContent(refText), "ref_text");
        form.Add(new StringContent(language), "language");
        form.Add(new StreamContent(audioStream), "file", fileName);

        var response = await http.PostAsync("/voices", form, ct);
        response.EnsureSuccessStatusCode();
        var voice = await response.Content.ReadFromJsonAsync<TtsVoice>(cancellationToken: ct);
        return voice ?? throw new InvalidOperationException("Empty voice response");
    }

    public async Task DeleteVoiceAsync(string voiceId, CancellationToken ct = default)
    {
        var response = await http.DeleteAsync($"/voices/{voiceId}", ct);
        response.EnsureSuccessStatusCode();
    }

    public async Task<bool> HealthAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await http.GetAsync("/health", ct);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}

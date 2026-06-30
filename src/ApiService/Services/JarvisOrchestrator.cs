using ApiService.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.AI;

namespace ApiService.Services;

public enum JarvisStatus
{
    Idle,
    Listening,
    Transcribing,
    Thinking,
    Speaking,
    Error
}

/// <summary>
/// Orchestrates the full voice pipeline:
/// audio in → STT (Whisper) → LLM (Ollama) → TTS (Qwen3) → audio out
/// Pushes status updates to the frontend via SignalR.
/// </summary>
public class JarvisOrchestrator(
    WhisperService stt,
    IChatClient chat,
    TtsProxy tts,
    SettingsService settings,
    CommandParser commandParser,
    IHubContext<JarvisHub> hub,
    ILogger<JarvisOrchestrator> logger)
{
    /// <summary>
    /// Process a recorded audio blob through the full pipeline.
    /// Returns the synthesized audio as a WAV stream.
    /// </summary>
    public async Task<PipelineResult> ProcessAudioAsync(
        Stream audioStream,
        string? voiceId = null,
        CancellationToken ct = default)
    {
        var status = new StatusReporter(hub);

        try
        {
            // 1) Transcribe
            await status.Set(JarvisStatus.Transcribing, "Transkribiere Audio...");
            var sttLang = await settings.GetAsync(SettingsService.KeySttLanguage, ct);
            var question = await stt.TranscribeAsync(audioStream, sttLang, ct);

            if (string.IsNullOrWhiteSpace(question))
            {
                await status.Set(JarvisStatus.Idle, "Keine Sprache erkannt");
                return new PipelineResult(string.Empty, string.Empty, Stream.Null);
            }

            if (commandParser.TryHandleCommand(question, out var commandAnswer))
            {
                await status.Set(JarvisStatus.Speaking, "Generiere Sprache...");
                var commandTtsReq = await BuildTtsRequestAsync(commandAnswer, voiceId, ct);
                var commandAudioOut = await tts.SynthesizeAsync(commandTtsReq, ct);

                await status.Set(JarvisStatus.Idle, "Bereit");
                return new PipelineResult(question, commandAnswer, commandAudioOut);
            }

            // 2) LLM
            var (answer, fullAnswer) = await GenerateAnswerAsync(question, status, ct);

            // 3) TTS
            await status.Set(JarvisStatus.Speaking, "Generiere Sprache...");
            var ttsReq = await BuildTtsRequestAsync(answer, voiceId, ct);
            var audioOut = await tts.SynthesizeAsync(ttsReq, ct);

            await status.Set(JarvisStatus.Idle, "Bereit");
            return new PipelineResult(question, fullAnswer, audioOut);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Pipeline error");
            await status.Set(JarvisStatus.Error, $"Fehler: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Just transcribe audio without LLM or TTS.
    /// </summary>
    public async Task<string> TranscribeOnlyAsync(Stream audioStream, CancellationToken ct = default)
    {
        var sttLang = await settings.GetAsync(SettingsService.KeySttLanguage, ct);
        return await stt.TranscribeAsync(audioStream, sttLang, ct);
    }

    /// <summary>
    /// Synthesize arbitrary text to audio (no LLM step).
    /// </summary>
    public async Task<Stream> SpeakTextAsync(string text, string? voiceId, CancellationToken ct = default)
    {
        var status = new StatusReporter(hub);
        await status.Set(JarvisStatus.Speaking, "Generiere Sprache...");
        var ttsReq = await BuildTtsRequestAsync(text, voiceId, ct);
        var audio = await tts.SynthesizeAsync(ttsReq, ct);
        await status.Set(JarvisStatus.Idle, "Bereit");
        return audio;
    }

    private async Task<(string truncated, string full)> GenerateAnswerAsync(
        string question, StatusReporter status, CancellationToken ct)
    {
        await status.Set(JarvisStatus.Thinking, "Denke nach...");

        var systemPrompt = await settings.GetAsync(SettingsService.KeyLlmSystemPrompt, ct);
        var temperature = double.Parse(await settings.GetAsync(SettingsService.KeyLlmTemperature, ct), System.Globalization.CultureInfo.InvariantCulture);
        var topP = double.Parse(await settings.GetAsync(SettingsService.KeyLlmTopP, ct), System.Globalization.CultureInfo.InvariantCulture);
        var maxTokens = int.Parse(await settings.GetAsync(SettingsService.KeyLlmMaxTokens, ct));

        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, systemPrompt),
            new(ChatRole.User, question)
        };

        var sb = new System.Text.StringBuilder();
        await foreach (var update in chat.GetStreamingResponseAsync(
            messages,
            new ChatOptions
            {
                Temperature = (float)temperature,
                TopP = (float)topP,
                MaxOutputTokens = maxTokens,
            },
            ct))
        {
            sb.Append(update.Text);
            // Could push incremental updates via SignalR here
        }

        var full = sb.ToString().Trim();
        return (full, full);
    }

    private async Task<TtsRequest> BuildTtsRequestAsync(string text, string? voiceId, CancellationToken ct)
    {
        voiceId ??= await settings.GetAsync(SettingsService.KeyTtsDefaultVoiceId, ct);
        if (string.IsNullOrEmpty(voiceId))
        {
            throw new InvalidOperationException(
                "Keine Standard-Stimme konfiguriert. Bitte zuerst eine Referenz-Stimme im Frontend hochladen.");
        }

        return new TtsRequest(
            Text: text,
            Language: await settings.GetAsync(SettingsService.KeyTtsLanguage, ct),
            RefAudioId: voiceId,
            Temperature: double.Parse(await settings.GetAsync(SettingsService.KeyTtsTemperature, ct), System.Globalization.CultureInfo.InvariantCulture),
            TopP: double.Parse(await settings.GetAsync(SettingsService.KeyTtsTopP, ct), System.Globalization.CultureInfo.InvariantCulture),
            TopK: int.Parse(await settings.GetAsync(SettingsService.KeyTtsTopK, ct)),
            MaxTokens: int.Parse(await settings.GetAsync(SettingsService.KeyTtsMaxTokens, ct)),
            RepetitionPenalty: double.Parse(await settings.GetAsync(SettingsService.KeyTtsRepetitionPenalty, ct), System.Globalization.CultureInfo.InvariantCulture)
        );
    }
}

public record PipelineResult(string Question, string Answer, Stream Audio);

/// <summary>
/// Helper to push JarvisStatus to all connected SignalR clients.
/// </summary>
public class StatusReporter(IHubContext<JarvisHub> hub)
{
    public async Task Set(JarvisStatus status, string message)
    {
        await hub.Clients.All.SendAsync("StatusChanged", new
        {
            status = status.ToString().ToLowerInvariant(),
            message,
            timestamp = DateTime.UtcNow
        });
    }
}

using Whisper.net;
using Whisper.net.Ggml;

namespace ApiService.Services;

/// <summary>
/// Whisper.net wrapper for STT.
/// On Apple Silicon, uses CoreML runtime for hardware acceleration.
/// On first use, downloads the ggml-base.bin model and CoreML encoder.
/// </summary>
public class WhisperService : IAsyncDisposable
{
    private readonly ILogger<WhisperService> _logger;
    private readonly WhisperFactory _factory;
    private readonly string _modelPath;
    private readonly string _language;

    public string ModelPath => _modelPath;

    public WhisperService(ILogger<WhisperService> logger, IConfiguration config, IWebHostEnvironment env)
    {
        _logger = logger;
        _language = config["Whisper:Language"] ?? "auto";

        var modelDir = Path.Combine(env.ContentRootPath, "wwwroot", "models");
        Directory.CreateDirectory(modelDir);
        _modelPath = Path.Combine(modelDir, "ggml-base.bin");

        if (!File.Exists(_modelPath))
        {
            _logger.LogInformation("Downloading Whisper base model to {Path}...", _modelPath);
            DownloadModel().GetAwaiter().GetResult();
        }
        else
        {
            _logger.LogInformation("Using existing Whisper model: {Path} ({Size} MB)",
                _modelPath, new FileInfo(_modelPath).Length / 1024 / 1024);
        }

        _factory = WhisperFactory.FromPath(_modelPath);
    }

    private async Task DownloadModel()
    {
        using var modelStream = await WhisperGgmlDownloader.Default.GetGgmlModelAsync(GgmlType.Base);
        await using var fs = File.Create(_modelPath);
        await modelStream.CopyToAsync(fs);
        _logger.LogInformation("Whisper model downloaded: {Size} bytes", fs.Length);

        // Try to also download CoreML encoder (Apple Silicon acceleration)
        try
        {
            var modelcName = "ggml-base-encoder.mlmodelc";
            var modelcPath = Path.Combine(Path.GetDirectoryName(_modelPath)!, modelcName);
            if (!Directory.Exists(modelcPath))
            {
                _logger.LogInformation("Downloading CoreML encoder for Apple Silicon acceleration...");
                await WhisperGgmlDownloader.Default.GetEncoderCoreMLModelAsync(GgmlType.Base)
                    .ExtractToPath(Path.GetDirectoryName(_modelPath)!);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CoreML encoder download failed (not on Apple Silicon?) - falling back to CPU");
        }
    }

    /// <summary>
    /// Transcribe audio bytes (WAV, MP3, WebM) to text.
    /// </summary>
    public async Task<string> TranscribeAsync(Stream audioStream, string? language = null, CancellationToken ct = default)
    {
        var lang = string.IsNullOrEmpty(language) || language == "auto" ? "auto" : language;
        using var processor = _factory.CreateBuilder()
            .WithLanguage(lang)
            .Build();

        var sb = new System.Text.StringBuilder();
        await foreach (var segment in processor.ProcessAsync(audioStream, ct))
        {
            sb.Append(segment.Text);
        }

        var result = sb.ToString().Trim();
        _logger.LogInformation("Transcribed: {Text}", result);
        return result;
    }

    public ValueTask DisposeAsync()
    {
        _factory?.Dispose();
        return ValueTask.CompletedTask;
    }
}

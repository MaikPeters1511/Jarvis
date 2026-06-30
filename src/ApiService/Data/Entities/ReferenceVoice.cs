using System.ComponentModel.DataAnnotations;

namespace ApiService.Data.Entities;

/// <summary>
/// A reference voice for Qwen3-TTS voice cloning.
/// The actual audio file is stored on disk (TtsService manages the bytes).
/// </summary>
public class ReferenceVoice
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];

    [Required, MaxLength(100)]
    public string Name { get; set; } = "";

    [Required, MaxLength(20)]
    public string Language { get; set; } = "Auto";

    [Required]
    public string RefText { get; set; } = "";

    [Required]
    public string Filename { get; set; } = "";

    public long SizeBytes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsDefault { get; set; }
}

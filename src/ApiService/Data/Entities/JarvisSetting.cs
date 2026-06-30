using System.ComponentModel.DataAnnotations;

namespace ApiService.Data.Entities;

/// <summary>
/// Key-value store for runtime-configurable settings.
/// Seeded with defaults on startup.
/// </summary>
public class JarvisSetting
{
    [Key, MaxLength(100)]
    public string Key { get; set; } = "";

    [Required]
    public string Value { get; set; } = "";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

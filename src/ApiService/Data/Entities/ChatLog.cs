using System.ComponentModel.DataAnnotations;

namespace ApiService.Data.Entities;

/// <summary>
/// Optional chat log for audit/history purposes.
/// </summary>
public class ChatLog
{
    [Key]
    public long Id { get; set; }

    [MaxLength(50)]
    public string Role { get; set; } = ""; // "user" | "assistant" | "system"

    [Required]
    public string Content { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

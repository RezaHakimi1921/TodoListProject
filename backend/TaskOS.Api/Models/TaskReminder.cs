namespace TaskOS.Api.Models;

public sealed class TaskReminder
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string RemindAt { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? FiredAt { get; set; }
    public string? TaskTitle { get; set; }
    public string? JiraKey { get; set; }
}
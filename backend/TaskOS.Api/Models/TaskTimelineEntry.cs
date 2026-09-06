namespace TaskOS.Api.Models;

public sealed class TaskTimelineEntry
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string Note { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

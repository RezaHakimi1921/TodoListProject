namespace TaskOS.Api.Models;

public sealed class TaskChecklistItem
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int IsDone { get; set; }
    public int SortOrder { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? DoneAt { get; set; }
}

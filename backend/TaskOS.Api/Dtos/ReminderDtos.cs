namespace TaskOS.Api.Dtos;

public sealed class TaskReminderDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string RemindAt { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? FiredAt { get; set; }
    public bool Fired => !string.IsNullOrWhiteSpace(FiredAt);
    public string? TaskTitle { get; set; }
    public string? JiraKey { get; set; }
}

public sealed class CreateTaskReminderRequest
{
    public string RemindAt { get; set; } = string.Empty;
    public string? Note { get; set; }
}
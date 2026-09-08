namespace TaskOS.Api.Models;

public sealed class TaskRecord
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = TaskStatuses.Open;
    public string EnergyType { get; set; } = EnergyTypes.Light;
    public string? Tags { get; set; }
    public string? StuckReason { get; set; }
    public string Ownership { get; set; } = TaskOwnerships.Mine;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public string? DoneAt { get; set; }
}

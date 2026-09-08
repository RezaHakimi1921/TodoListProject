namespace TaskOS.Api.Dtos;

public sealed class TaskDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string EnergyType { get; set; } = string.Empty;
    public IReadOnlyList<string> Tags { get; set; } = [];
    public string? StuckReason { get; set; }
    public bool IsAging { get; set; }
    public int AgingDays { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public string? DoneAt { get; set; }
    public int ChecklistTotal { get; set; }
    public int ChecklistDone { get; set; }
    public string? JiraKey { get; set; }
    public string? JiraUrl { get; set; }
    public string? JiraDescription { get; set; }
    public string Ownership { get; set; } = "Mine";
}

public sealed class CreateTaskRequest
{
    public string Title { get; set; } = string.Empty;
    public string? EnergyType { get; set; }
    public string? Tags { get; set; }
    public IReadOnlyList<string>? TagList { get; set; }
}

public sealed class UpdateTaskRequest
{
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string EnergyType { get; set; } = string.Empty;
    public string? Tags { get; set; }
    public IReadOnlyList<string>? TagList { get; set; }
    public string? Ownership { get; set; }
}

public sealed class UpdateTaskStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? StuckReason { get; set; }
}

public sealed class AddTimelineRequest
{
    public string Note { get; set; } = string.Empty;
}

public sealed class TimelineEntryDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string Note { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class TaskDayDto
{
    public string Date { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Done { get; set; }
}

public sealed class SimilarTaskDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? DoneAt { get; set; }
    public double Similarity { get; set; }
}

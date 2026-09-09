namespace TaskOS.Api.Dtos;

public sealed class WorkFocusDto
{
    public bool Active { get; set; }
    public string Description { get; set; } = string.Empty;
    public int? TaskId { get; set; }
    public int? ProblemId { get; set; }
    public string? StartedAt { get; set; }
    public string? UpdatedAt { get; set; }
    public bool IsResting { get; set; }
    public JiraSwitchPendingDto? PendingSwitch { get; set; }
}

public sealed class SetFocusRequest
{
    public string Description { get; set; } = string.Empty;
    public int? TaskId { get; set; }
    public int? ProblemId { get; set; }
    public int? DurationMinutes { get; set; }
    public string? Source { get; set; }
    public bool Log { get; set; } = true;
}

public sealed class FocusActionRequest
{
    public int? DurationMinutes { get; set; }
    public string? Source { get; set; }
    public bool MarkTaskDone { get; set; }
    public int? TaskId { get; set; }
}

public sealed class StartRestRequest
{
    public string? Description { get; set; }
}

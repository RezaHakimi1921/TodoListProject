namespace TaskOS.Api.Dtos;

public sealed class WorkLogDto
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public int DurationMinutes { get; set; }
    public string Source { get; set; } = string.Empty;
    public int? TaskId { get; set; }
    public int? ProblemId { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class CaptureWorkLogRequest
{
    public string Description { get; set; } = string.Empty;
    public int? DurationMinutes { get; set; }
    public string? Source { get; set; }
    public int? TaskId { get; set; }
    public int? ProblemId { get; set; }
}

public sealed class WorkLogGroupDto
{
    public string Title { get; set; } = string.Empty;
    public int TotalMinutes { get; set; }
    public IReadOnlyList<WorkLogDto> Entries { get; set; } = [];
}

public sealed class WorkLogSummaryDto
{
    public string Date { get; set; } = string.Empty;
    public int TotalMinutes { get; set; }
    public IReadOnlyList<WorkLogGroupDto> Groups { get; set; } = [];
    public string CopyText { get; set; } = string.Empty;
}

public sealed class EntityWorkLogDto
{
    public int TotalMinutes { get; set; }
    public IReadOnlyList<WorkLogDto> Entries { get; set; } = [];
}

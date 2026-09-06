namespace TaskOS.Api.Dtos;

public static class TrashKinds
{
    public const string Task = "task";
    public const string Timeline = "timeline";
    public const string DailyLog = "dailylog";
    public const string WorkLog = "worklog";
    public const string Problem = "problem";
    public const string Option = "option";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Task, Timeline, DailyLog, WorkLog, Problem, Option
    };
}

public sealed class TrashItemDto
{
    public string Kind { get; set; } = string.Empty;
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? DeletedAt { get; set; }
}

public sealed class TrashActionRequest
{
    public string Kind { get; set; } = string.Empty;
    public int Id { get; set; }
}

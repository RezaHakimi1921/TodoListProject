namespace TaskOS.Api.Models;

public sealed class WorkLogEntry
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public int DurationMinutes { get; set; } = 15;
    public string Source { get; set; } = WorkLogSources.Manual;
    public int? TaskId { get; set; }
    public int? ProblemId { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}

public static class WorkLogSources
{
    public const string Timer = "Timer";
    public const string Extension = "Extension";
    public const string Manual = "Manual";
    public const string Break = "Break";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Timer, Extension, Manual, Break
    };
}

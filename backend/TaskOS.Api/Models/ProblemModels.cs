namespace TaskOS.Api.Models;

public static class ProblemStatuses
{
    public const string Open = "Open";
    public const string Monitoring = "Monitoring";
    public const string Resolved = "Resolved";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Open, Monitoring, Resolved
    };

    public static string Normalize(string? value)
    {
        var status = (value ?? string.Empty).Trim();
        if (status.Equals("Exploring", StringComparison.OrdinalIgnoreCase)) return Open;
        if (status.Equals("Chosen", StringComparison.OrdinalIgnoreCase)) return Monitoring;
        if (status.Equals("Validated", StringComparison.OrdinalIgnoreCase)) return Resolved;
        if (All.Contains(status))
        {
            return All.First(item => item.Equals(status, StringComparison.OrdinalIgnoreCase));
        }

        return Open;
    }
}

public static class ProblemActionStatuses
{
    public const string Open = "Open";
    public const string Done = "Done";
}

public sealed class ProblemRecord
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = ProblemStatuses.Open;
    public string? NoTimeNote { get; set; }
    public string? InfiniteTimeNote { get; set; }
    public int? ChosenOptionId { get; set; }
    public string? PremortemSign { get; set; }
    public string? ExpectedBehavior { get; set; }
    public string? ActualBehavior { get; set; }
    public string? RootCause { get; set; }
    public string? DetectionGap { get; set; }
    public string? AffectedPopulation { get; set; }
    public string? Resolution { get; set; }
    public string? Recovery { get; set; }
    public string? ValidationNote { get; set; }
    public string? Prevention { get; set; }
    public string? ImpactBranches { get; set; }
    public string? ImpactCustomers { get; set; }
    public string? ImpactRecords { get; set; }
    public string? ImpactServices { get; set; }
    public string? ImpactSupport { get; set; }
    public string? ImpactBusiness { get; set; }
    public string? StartedAt { get; set; }
    public string? FirstAffectedAt { get; set; }
    public string? DetectedAt { get; set; }
    public string? RootCauseFoundAt { get; set; }
    public string? FixedAt { get; set; }
    public string? RecoveryCompletedAt { get; set; }
    public string? CostTechnical { get; set; }
    public string? CostOperational { get; set; }
    public string? CostBusiness { get; set; }
    public string? CostOpportunity { get; set; }
    public string? SectionSavedAt { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public sealed class ProblemOptionRecord
{
    public int Id { get; set; }
    public int ProblemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? JuniorExplain { get; set; }
    public int SortOrder { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class ProblemActionRecord
{
    public int Id { get; set; }
    public int ProblemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Owner { get; set; }
    public string? Deadline { get; set; }
    public string Status { get; set; } = ProblemActionStatuses.Open;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public sealed class TaskProblemLinkRecord
{
    public int TaskId { get; set; }
    public int ProblemId { get; set; }
    public string ProblemTitle { get; set; } = string.Empty;
    public string ProblemStatus { get; set; } = string.Empty;
    public string TaskTitle { get; set; } = string.Empty;
    public string TaskStatus { get; set; } = string.Empty;
    public string? JiraKey { get; set; }
    public string? JiraUrl { get; set; }
}

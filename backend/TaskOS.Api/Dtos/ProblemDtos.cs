namespace TaskOS.Api.Dtos;

public sealed class ProblemOptionDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? JuniorExplain { get; set; }
    public int SortOrder { get; set; }
    public bool IsChosen { get; set; }
}

public sealed class ProblemActionDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Owner { get; set; }
    public string? Deadline { get; set; }
    public string Status { get; set; } = "Open";
}

public sealed class ProblemTaskDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? JiraKey { get; set; }
    public string? JiraUrl { get; set; }
}

public sealed class ProblemLinkDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public sealed class ProblemDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Reality { get; set; }
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
    public int TaskCount { get; set; }
    public IReadOnlyList<ProblemTaskDto> Tasks { get; set; } = [];
    public IReadOnlyList<ProblemActionDto> Actions { get; set; } = [];
    public string? NoTimeNote { get; set; }
    public string? InfiniteTimeNote { get; set; }
    public int? ChosenOptionId { get; set; }
    public string? PremortemSign { get; set; }
    public IReadOnlyList<ProblemOptionDto> Options { get; set; } = [];
    public bool CanChoose { get; set; }
    public string? Blocker { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public sealed class CreateProblemRequest
{
    public string Title { get; set; } = string.Empty;
    public int? TaskId { get; set; }
}

public sealed class UpdateProblemRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Status { get; set; }
    public string? Reality { get; set; }
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
    public string? NoTimeNote { get; set; }
    public string? InfiniteTimeNote { get; set; }
    public IReadOnlyList<int>? AttachTaskIds { get; set; }
}

public sealed class UpsertProblemActionRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Owner { get; set; }
    public string? Deadline { get; set; }
    public string? Status { get; set; }
}

public sealed class AttachTaskRequest
{
    public int TaskId { get; set; }
    public IReadOnlyList<int>? TaskIds { get; set; }
}

public sealed class UpsertOptionRequest
{
    public string Title { get; set; } = string.Empty;
    public string? JuniorExplain { get; set; }
}

public sealed class ChooseOptionRequest
{
    public int OptionId { get; set; }
    public string PremortemSign { get; set; } = string.Empty;
}

public sealed class ValidateProblemRequest
{
    public string? Note { get; set; }
}

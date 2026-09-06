namespace TaskOS.Api.Dtos;

public sealed class ProblemOptionDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? JuniorExplain { get; set; }
    public int SortOrder { get; set; }
    public bool IsChosen { get; set; }
}

public sealed class ProblemDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
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
}

public sealed class UpdateProblemRequest
{
    public string Title { get; set; } = string.Empty;
    public string? NoTimeNote { get; set; }
    public string? InfiniteTimeNote { get; set; }
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

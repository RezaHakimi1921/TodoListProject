namespace TaskOS.Api.Models;

public static class ProblemStatuses
{
    public const string Exploring = "Exploring";
    public const string Chosen = "Chosen";
    public const string Validated = "Validated";
}

public sealed class ProblemRecord
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = ProblemStatuses.Exploring;
    public string? NoTimeNote { get; set; }
    public string? InfiniteTimeNote { get; set; }
    public int? ChosenOptionId { get; set; }
    public string? PremortemSign { get; set; }
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

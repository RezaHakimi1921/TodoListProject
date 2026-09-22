namespace TaskOS.Api.Dtos;

public sealed class BoardActivityDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string JiraKey { get; set; } = string.Empty;
    public string? JiraUrl { get; set; }
    /// <summary>rest | meeting</summary>
    public string Kind { get; set; } = "rest";
    public bool NeedsNote { get; set; }
    public int SortOrder { get; set; }
    public bool Enabled { get; set; } = true;
}

public sealed class SaveBoardActivitiesRequest
{
    public List<BoardActivityDto> Items { get; set; } = [];
}

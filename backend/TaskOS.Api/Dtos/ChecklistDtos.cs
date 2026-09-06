namespace TaskOS.Api.Dtos;

public sealed class ChecklistItemDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsDone { get; set; }
    public int SortOrder { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? DoneAt { get; set; }
}

public sealed class CreateChecklistItemRequest
{
    public string Title { get; set; } = string.Empty;
}

public sealed class UpdateChecklistItemRequest
{
    public string? Title { get; set; }
    public bool? IsDone { get; set; }
    public int? SortOrder { get; set; }
}

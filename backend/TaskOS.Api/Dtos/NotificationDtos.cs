namespace TaskOS.Api.Dtos;

public sealed class NotificationDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string TaskTitle { get; set; } = string.Empty;
    public string TaskStatus { get; set; } = string.Empty;
    public string JiraKey { get; set; } = string.Empty;
    public string? JiraUrl { get; set; }
    public string CommentId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public bool Read { get; set; }
}

public sealed class NotificationSummaryDto
{
    public int UnreadCount { get; set; }
    public IReadOnlyList<NotificationDto> Items { get; set; } = [];
}

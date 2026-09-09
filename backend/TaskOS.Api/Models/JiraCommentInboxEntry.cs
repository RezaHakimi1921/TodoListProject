namespace TaskOS.Api.Models;

public sealed class JiraCommentInboxEntry
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string JiraKey { get; set; } = string.Empty;
    public string CommentId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string? SeenAt { get; set; }
    public string ReceivedAt { get; set; } = string.Empty;
    public string TaskTitle { get; set; } = string.Empty;
    public string TaskStatus { get; set; } = string.Empty;
    public string? JiraUrl { get; set; }
}

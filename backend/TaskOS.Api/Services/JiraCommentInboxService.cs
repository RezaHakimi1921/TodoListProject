using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class JiraCommentInboxService : IJiraCommentInboxService
{
    private readonly IJiraCommentInboxRepository _inbox;

    public JiraCommentInboxService(IJiraCommentInboxRepository inbox)
    {
        _inbox = inbox;
    }

    public async Task<NotificationSummaryDto> ListAsync(bool unreadOnly)
    {
        var rows = await _inbox.ListAsync(unreadOnly);
        return new NotificationSummaryDto
        {
            UnreadCount = await _inbox.CountUnreadAsync(),
            Items = rows.Select(ToDto).ToList()
        };
    }

    public Task<int> CountUnreadAsync() => _inbox.CountUnreadAsync();

    public Task<bool> AddIncomingAsync(
        int taskId,
        string jiraKey,
        string commentId,
        string authorName,
        string body,
        string createdAt)
    {
        return _inbox.InsertIfNewAsync(new JiraCommentInboxEntry
        {
            TaskId = taskId,
            JiraKey = jiraKey.Trim().ToUpperInvariant(),
            CommentId = commentId.Trim(),
            AuthorName = string.IsNullOrWhiteSpace(authorName) ? "کسی" : authorName.Trim(),
            Body = TrimBody(body),
            CreatedAt = string.IsNullOrWhiteSpace(createdAt) ? TaskMapping.Now() : createdAt.Trim(),
            ReceivedAt = TaskMapping.Now()
        });
    }

    public Task MarkReadAsync(int id) =>
        _inbox.MarkReadAsync(id, TaskMapping.Now());

    public Task MarkReadByTaskAsync(int taskId) =>
        _inbox.MarkReadByTaskAsync(taskId, TaskMapping.Now());

    private static NotificationDto ToDto(JiraCommentInboxEntry entry) => new()
    {
        Id = entry.Id,
        TaskId = entry.TaskId,
        TaskTitle = entry.TaskTitle,
        TaskStatus = entry.TaskStatus,
        JiraKey = entry.JiraKey,
        JiraUrl = entry.JiraUrl,
        CommentId = entry.CommentId,
        AuthorName = entry.AuthorName,
        Body = entry.Body,
        CreatedAt = entry.CreatedAt,
        Read = !string.IsNullOrWhiteSpace(entry.SeenAt)
    };

    private static string TrimBody(string? body)
    {
        var text = (body ?? string.Empty).Replace('\n', ' ').Trim();
        return text.Length <= 280 ? text : text[..280] + "\u2026";
    }
}

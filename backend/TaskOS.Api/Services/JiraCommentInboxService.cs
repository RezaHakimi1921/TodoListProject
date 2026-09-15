using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class JiraCommentInboxService : IJiraCommentInboxService
{
    private readonly IJiraCommentInboxRepository _inbox;
    private readonly IPushNotificationService _push;

    public JiraCommentInboxService(IJiraCommentInboxRepository inbox, IPushNotificationService push)
    {
        _inbox = inbox;
        _push = push;
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

    public Task<(int NewTasks, int Comments, int Khadang, int Reminders)> CountUnreadByKindAsync() => _inbox.CountUnreadByKindAsync();

    public Task<IReadOnlyDictionary<int, int>> UnreadReminderCountsByTaskIdsAsync(IReadOnlyList<int> taskIds) =>
        _inbox.UnreadReminderCountsByTaskIdsAsync(taskIds);

    public async Task<bool> AddIncomingAsync(
        int taskId,
        string jiraKey,
        string commentId,
        string authorName,
        string body,
        string createdAt,
        bool sendPush = true)
    {
        var inserted = await _inbox.InsertIfNewAsync(new JiraCommentInboxEntry
        {
            TaskId = taskId,
            JiraKey = jiraKey.Trim().ToUpperInvariant(),
            CommentId = commentId.Trim(),
            AuthorName = string.IsNullOrWhiteSpace(authorName) ? "کسی" : authorName.Trim(),
            Body = TrimBody(body),
            CreatedAt = string.IsNullOrWhiteSpace(createdAt) ? TaskMapping.Now() : createdAt.Trim(),
            ReceivedAt = TaskMapping.Now()
        });
        if (inserted && sendPush)
        {
            var who = string.IsNullOrWhiteSpace(authorName) ? "کسی" : authorName.Trim();
            await SafePush($"{who} روی {jiraKey.Trim().ToUpperInvariant()}", TrimBody(body), $"/tasks/{taskId}");
        }

        return inserted;
    }

    public async Task<bool> AddNewTaskAsync(int taskId, string jiraKey, string title, string createdAt)
    {
        var key = jiraKey.Trim().ToUpperInvariant();
        var inserted = await _inbox.InsertIfNewAsync(new JiraCommentInboxEntry
        {
            TaskId = taskId,
            JiraKey = key,
            CommentId = "new-task:" + key,
            AuthorName = "جیرا",
            Body = string.IsNullOrWhiteSpace(title) ? "تسک جدید ثبت شد" : title.Trim(),
            CreatedAt = string.IsNullOrWhiteSpace(createdAt) ? TaskMapping.Now() : createdAt.Trim(),
            ReceivedAt = TaskMapping.Now()
        });
        if (inserted)
        {
            await SafePush("تسک جدید جیرا", string.IsNullOrWhiteSpace(title) ? key : title.Trim(), $"/tasks/{taskId}");
        }

        return inserted;
    }

    public Task SeedRecentNewTasksAsync()
    {
        var now = DateTime.UtcNow;
        return _inbox.SeedRecentNewTasksAsync(
            now.AddHours(-30).ToString("o"),
            now.Date.ToString("o"),
            TaskMapping.Now());
    }

    public Task MarkReadAsync(int id) =>
        _inbox.MarkReadAsync(id, TaskMapping.Now());

    public Task MarkReadByTaskAsync(int taskId) =>
        _inbox.MarkReadByTaskAsync(taskId, TaskMapping.Now());

    public Task MarkReadRemindersByTaskAsync(int taskId) =>
        _inbox.MarkReadRemindersByTaskAsync(taskId, TaskMapping.Now());

    public Task MarkAllRemindersReadAsync() =>
        _inbox.MarkAllRemindersReadAsync(TaskMapping.Now());

    public Task MarkReadByJiraKeyAsync(string jiraKey) =>
        _inbox.MarkReadByJiraKeyAsync(jiraKey, TaskMapping.Now());

    private static NotificationDto ToDto(JiraCommentInboxEntry entry) => new()
    {
        Id = entry.Id,
        TaskId = entry.TaskId,
        Kind = IsReminder(entry.CommentId) ? "reminder" : IsNewTask(entry.CommentId) ? "new-task" : "comment",
        TaskTitle = entry.TaskTitle,
        TaskStatus = entry.TaskStatus,
        JiraKey = entry.JiraKey,
        JiraUrl = entry.JiraUrl,
        CommentId = entry.CommentId,
        AuthorName = entry.AuthorName,
        Body = IsNewTask(entry.CommentId) ? "تسک جدید ثبت شد" : entry.Body,
        CreatedAt = entry.CreatedAt,
        Read = !string.IsNullOrWhiteSpace(entry.SeenAt)
    };

    private static bool IsReminder(string? commentId) =>
        (commentId ?? string.Empty).StartsWith("reminder:", StringComparison.OrdinalIgnoreCase);

    private static bool IsNewTask(string? commentId) =>
        (commentId ?? string.Empty).StartsWith("new-task:", StringComparison.OrdinalIgnoreCase);

    private async Task SafePush(string title, string body, string url)
    {
        try
        {
            await _push.SendAsync(title, body, url);
        }
        catch
        {
            // Phone push must not break inbox sync.
        }
    }

    private static string TrimBody(string? body)
    {
        var text = (body ?? string.Empty).Replace('\n', ' ').Trim();
        return text.Length <= 280 ? text : text[..280] + "\u2026";
    }
}

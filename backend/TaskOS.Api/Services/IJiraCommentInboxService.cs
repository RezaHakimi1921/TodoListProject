using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IJiraCommentInboxService
{
    Task<NotificationSummaryDto> ListAsync(bool unreadOnly);
    Task<int> CountUnreadAsync();
    Task<(int NewTasks, int Comments, int Khadang, int Reminders)> CountUnreadByKindAsync();
    Task<IReadOnlyDictionary<int, int>> UnreadReminderCountsByTaskIdsAsync(IReadOnlyList<int> taskIds);
    Task<bool> AddIncomingAsync(int taskId, string jiraKey, string commentId, string authorName, string body, string createdAt, bool sendPush = true);
    Task<bool> AddNewTaskAsync(int taskId, string jiraKey, string title, string createdAt);
    Task SeedRecentNewTasksAsync();
    Task MarkReadAsync(int id);
    Task MarkReadByTaskAsync(int taskId);
    Task MarkReadRemindersByTaskAsync(int taskId);
    Task MarkAllRemindersReadAsync();
    Task MarkReadByJiraKeyAsync(string jiraKey);
}

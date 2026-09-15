using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface IJiraCommentInboxRepository
{
    Task<IReadOnlyList<JiraCommentInboxEntry>> ListAsync(bool unreadOnly);
    Task<int> CountUnreadAsync();
    Task<(int NewTasks, int Comments, int Khadang, int Reminders)> CountUnreadByKindAsync();
    Task<IReadOnlyDictionary<int, int>> UnreadReminderCountsByTaskIdsAsync(IReadOnlyList<int> taskIds);
    Task<bool> InsertIfNewAsync(JiraCommentInboxEntry entry);
    Task SeedRecentNewTasksAsync(string sinceIso, string startOfTodayIso, string receivedAt);
    Task MarkReadAsync(int id, string seenAt);
    Task MarkReadByTaskAsync(int taskId, string seenAt);
    Task MarkReadRemindersByTaskAsync(int taskId, string seenAt);
    Task MarkAllRemindersReadAsync(string seenAt);
    Task MarkReadByJiraKeyAsync(string jiraKey, string seenAt);
}

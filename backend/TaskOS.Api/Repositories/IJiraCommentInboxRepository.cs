using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface IJiraCommentInboxRepository
{
    Task<IReadOnlyList<JiraCommentInboxEntry>> ListAsync(bool unreadOnly);
    Task<int> CountUnreadAsync();
    Task<bool> InsertIfNewAsync(JiraCommentInboxEntry entry);
    Task MarkReadAsync(int id, string seenAt);
    Task MarkReadByTaskAsync(int taskId, string seenAt);
}

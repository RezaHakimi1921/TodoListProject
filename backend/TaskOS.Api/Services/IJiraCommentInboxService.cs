using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IJiraCommentInboxService
{
    Task<NotificationSummaryDto> ListAsync(bool unreadOnly);
    Task<int> CountUnreadAsync();
    Task<bool> AddIncomingAsync(int taskId, string jiraKey, string commentId, string authorName, string body, string createdAt);
    Task MarkReadAsync(int id);
    Task MarkReadByTaskAsync(int taskId);
}

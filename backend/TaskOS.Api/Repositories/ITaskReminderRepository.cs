using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface ITaskReminderRepository
{
    Task<IReadOnlyList<TaskReminder>> ListByTaskAsync(int taskId);
    Task<IReadOnlyDictionary<int, string>> NextRemindAtByTaskIdsAsync(IReadOnlyList<int> taskIds);
    Task<IReadOnlyDictionary<int, int>> PendingCountByTaskIdsAsync(IReadOnlyList<int> taskIds);
    Task<TaskReminder?> GetAsync(int id);
    Task<TaskReminder> CreateAsync(TaskReminder reminder);
    Task DeleteAsync(int id);
    Task<IReadOnlyList<TaskReminder>> ListDueAsync(string nowIso);
    Task MarkFiredAsync(int id, string firedAt);
    Task<bool> UpdateAsync(int id, string remindAt, string? note);
    Task<IReadOnlyList<TaskReminder>> ListPendingAsync();
    Task<IReadOnlyList<TaskReminder>> ListFiredAsync(int limit = 50);
}
using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface ITaskReminderService
{
    Task<IReadOnlyList<TaskReminderDto>> ListByTaskAsync(int taskId);
    Task AttachAsync(IReadOnlyList<TaskDto> dtos);
    Task<TaskReminderDto?> CreateAsync(int taskId, CreateTaskReminderRequest request);
    Task<bool> DeleteAsync(int id);
    Task<TaskReminderDto?> UpdateAsync(int id, CreateTaskReminderRequest request);
    Task<IReadOnlyList<TaskReminderDto>> ListPendingAsync();
    Task<IReadOnlyList<TaskReminderDto>> ListFiredAsync(int limit = 50);
    Task FireDueAsync(CancellationToken cancellationToken = default);
}
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface ITaskRepository
{
    Task<IReadOnlyList<TaskRecord>> ListAsync(string? status, string? energyType, string? tag);
    Task<TaskRecord?> GetByIdAsync(int id);
    Task<IReadOnlyList<TaskRecord>> ListDoneAsync();
    Task<int> CreateAsync(TaskRecord task);
    Task<bool> UpdateAsync(TaskRecord task);
    Task<bool> DeleteAsync(int id);
    Task<IReadOnlyList<TaskTimelineEntry>> ListTimelineAsync(int taskId);
    Task<TaskTimelineEntry> AddTimelineAsync(int taskId, string note, string createdAt);
    Task<IReadOnlyList<TaskRecord>> ListRelatedToDateAsync(string logDate);
}

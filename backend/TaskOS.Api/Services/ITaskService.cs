using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface ITaskService
{
    Task<IReadOnlyList<TaskDto>> ListAsync(string? status, string? energyType, string? tag, string? date = null, string? q = null, bool includeDone = false);
    Task<TaskDto?> GetAsync(int id);
    Task<TaskDto> CreateTaskAsync(CreateTaskRequest request);
    Task<TaskDto?> UpdateAsync(int id, UpdateTaskRequest request);
    Task<TaskDto?> UpdateStatusAsync(int id, UpdateTaskStatusRequest request);
    Task<TaskDto?> SetPinnedAsync(int id, bool pinned);
    Task<TaskDto?> SetOwnershipAsync(int id, string ownership);
    Task<bool> DeleteAsync(int id);
    Task<IReadOnlyList<SimilarTaskDto>> GetSimilarTasksAsync(string title);
    Task<TimelineEntryDto?> AddTimelineAsync(int taskId, string note);
    Task<IReadOnlyList<TimelineEntryDto>> ListTimelineAsync(int taskId);
    Task<IReadOnlyList<TaskDto>> ListRelatedToDateAsync(string logDate);
    Task<TaskDto?> FindSameTitleTodayAsync(string title);
    Task<IReadOnlyList<TaskDayDto>> ListDaysAsync();
}

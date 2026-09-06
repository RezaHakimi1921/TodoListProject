using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface ITaskService
{
    Task<IReadOnlyList<TaskDto>> ListAsync(string? status, string? energyType, string? tag);
    Task<TaskDto?> GetAsync(int id);
    Task<TaskDto> CreateTaskAsync(CreateTaskRequest request);
    Task<TaskDto?> UpdateAsync(int id, UpdateTaskRequest request);
    Task<TaskDto?> UpdateStatusAsync(int id, UpdateTaskStatusRequest request);
    Task<bool> DeleteAsync(int id);
    Task<IReadOnlyList<SimilarTaskDto>> GetSimilarTasksAsync(string title);
    Task<TimelineEntryDto?> AddTimelineAsync(int taskId, string note);
    Task<IReadOnlyList<TimelineEntryDto>> ListTimelineAsync(int taskId);
    Task<IReadOnlyList<TaskDto>> ListRelatedToDateAsync(string logDate);
}

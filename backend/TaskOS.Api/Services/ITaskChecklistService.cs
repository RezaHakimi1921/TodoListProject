using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface ITaskChecklistService
{
    Task<IReadOnlyList<ChecklistItemDto>> ListAsync(int taskId);
    Task<ChecklistItemDto> AddAsync(int taskId, CreateChecklistItemRequest request);
    Task<ChecklistItemDto?> UpdateAsync(int taskId, int itemId, UpdateChecklistItemRequest request);
    Task<bool> DeleteAsync(int taskId, int itemId);
    Task AttachCountsAsync(IReadOnlyList<TaskDto> tasks);
}

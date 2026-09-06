using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface ITaskChecklistRepository
{
    Task<IReadOnlyList<TaskChecklistItem>> ListByTaskAsync(int taskId);
    Task<TaskChecklistItem?> GetAsync(int taskId, int itemId);
    Task<int> NextSortOrderAsync(int taskId);
    Task<TaskChecklistItem> CreateAsync(TaskChecklistItem item);
    Task<bool> UpdateAsync(TaskChecklistItem item);
    Task<bool> DeleteAsync(int taskId, int itemId);
    Task<IReadOnlyDictionary<int, ChecklistCount>> CountsByTaskIdsAsync(IReadOnlyCollection<int> taskIds);
}

public sealed class ChecklistCount
{
    public int TaskId { get; set; }
    public int Total { get; set; }
    public int Done { get; set; }
}

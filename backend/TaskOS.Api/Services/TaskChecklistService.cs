using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class TaskChecklistService : ITaskChecklistService
{
    private readonly ITaskRepository _tasks;
    private readonly ITaskChecklistRepository _items;

    public TaskChecklistService(ITaskRepository tasks, ITaskChecklistRepository items)
    {
        _tasks = tasks;
        _items = items;
    }

    public async Task<IReadOnlyList<ChecklistItemDto>> ListAsync(int taskId)
    {
        if (await _tasks.GetByIdAsync(taskId) is null)
        {
            throw new KeyNotFoundException("Task not found.");
        }

        var rows = await _items.ListByTaskAsync(taskId);
        return rows.Select(ToDto).ToList();
    }

    public async Task<ChecklistItemDto> AddAsync(int taskId, CreateChecklistItemRequest request)
    {
        if (await _tasks.GetByIdAsync(taskId) is null)
        {
            throw new KeyNotFoundException("Task not found.");
        }

        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length == 0)
        {
            throw new ArgumentException("Title is required.");
        }

        var created = await _items.CreateAsync(new TaskChecklistItem
        {
            TaskId = taskId,
            Title = title,
            IsDone = 0,
            SortOrder = await _items.NextSortOrderAsync(taskId),
            CreatedAt = TaskMapping.Now()
        });
        return ToDto(created);
    }

    public async Task<ChecklistItemDto?> UpdateAsync(int taskId, int itemId, UpdateChecklistItemRequest request)
    {
        var existing = await _items.GetAsync(taskId, itemId);
        if (existing is null)
        {
            return null;
        }

        if (request.Title is not null)
        {
            var title = request.Title.Trim();
            if (title.Length == 0)
            {
                throw new ArgumentException("Title is required.");
            }

            existing.Title = title;
        }

        if (request.IsDone is bool done)
        {
            existing.IsDone = done ? 1 : 0;
            existing.DoneAt = done ? existing.DoneAt ?? TaskMapping.Now() : null;
        }

        if (request.SortOrder is int sort)
        {
            existing.SortOrder = sort;
        }

        await _items.UpdateAsync(existing);
        return ToDto(existing);
    }

    public async Task<bool> DeleteAsync(int taskId, int itemId) => await _items.DeleteAsync(taskId, itemId);

    public async Task AttachCountsAsync(IReadOnlyList<TaskDto> tasks)
    {
        if (tasks.Count == 0) return;
        var counts = await _items.CountsByTaskIdsAsync(tasks.Select(task => task.Id).ToList());
        foreach (var task in tasks)
        {
            if (!counts.TryGetValue(task.Id, out var count)) continue;
            task.ChecklistTotal = count.Total;
            task.ChecklistDone = count.Done;
        }
    }

    private static ChecklistItemDto ToDto(TaskChecklistItem item) => new()
    {
        Id = item.Id,
        TaskId = item.TaskId,
        Title = item.Title,
        IsDone = item.IsDone == 1,
        SortOrder = item.SortOrder,
        CreatedAt = item.CreatedAt,
        DoneAt = item.DoneAt
    };
}

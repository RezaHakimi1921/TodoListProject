using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;
using TaskOS.Api.Services.Similarity;

namespace TaskOS.Api.Services;

public sealed class TaskService : ITaskService
{
    private readonly ITaskRepository _tasks;
    private readonly ITaskChecklistService _checklist;
    private readonly int _agingDays;
    private readonly double _similarityThreshold;

    public TaskService(ITaskRepository tasks, ITaskChecklistService checklist, IConfiguration configuration)
    {
        _tasks = tasks;
        _checklist = checklist;
        _agingDays = configuration.GetValue("TaskOS:AgingDays", 3);
        _similarityThreshold = configuration.GetValue("TaskOS:SimilarityThreshold", 0.6);
    }

    public async Task<IReadOnlyList<TaskDto>> ListAsync(string? status, string? energyType, string? tag, string? date = null, string? q = null)
    {
        var rows = await _tasks.ListAsync(status, energyType, tag, date, q);
        var dtos = rows.Select(r => TaskMapping.ToDto(r, _agingDays)).ToList();
        await _checklist.AttachCountsAsync(dtos);
        return dtos;
    }

    public async Task<TaskDto?> GetAsync(int id)
    {
        var row = await _tasks.GetByIdAsync(id);
        if (row is null) return null;
        var dto = TaskMapping.ToDto(row, _agingDays);
        await _checklist.AttachCountsAsync([dto]);
        return dto;
    }

    public async Task<TaskDto> CreateTaskAsync(CreateTaskRequest request)
    {
        var title = request.Title.Trim();
        if (title.Length == 0)
        {
            throw new ArgumentException("Title is required.");
        }

        var energy = string.IsNullOrWhiteSpace(request.EnergyType) ? EnergyTypes.Light : request.EnergyType.Trim();
        if (!EnergyTypes.All.Contains(energy))
        {
            throw new ArgumentException("EnergyType must be Deep or Light.");
        }

        var now = TaskMapping.Now();
        var id = await _tasks.CreateAsync(new TaskRecord
        {
            Title = title,
            Status = TaskStatuses.Open,
            EnergyType = energy,
            Tags = TaskMapping.JoinTags(request.Tags, request.TagList),
            CreatedAt = now,
            UpdatedAt = now
        });

        var created = await _tasks.GetByIdAsync(id)
                      ?? throw new InvalidOperationException("Task was created but could not be reloaded.");
        return TaskMapping.ToDto(created, _agingDays);
    }

    public async Task<TaskDto?> UpdateAsync(int id, UpdateTaskRequest request)
    {
        var existing = await _tasks.GetByIdAsync(id);
        if (existing is null)
        {
            return null;
        }

        var title = request.Title.Trim();
        if (title.Length == 0)
        {
            throw new ArgumentException("Title is required.");
        }

        if (!TaskStatuses.All.Contains(request.Status))
        {
            throw new ArgumentException("Invalid status.");
        }

        if (!EnergyTypes.All.Contains(request.EnergyType))
        {
            throw new ArgumentException("EnergyType must be Deep or Light.");
        }

        ApplyStatus(existing, request.Status, existing.StuckReason);
        existing.Title = title;
        existing.EnergyType = request.EnergyType;
        existing.Tags = TaskMapping.JoinTags(request.Tags, request.TagList);
        existing.UpdatedAt = TaskMapping.Now();
        await _tasks.UpdateAsync(existing);
        return TaskMapping.ToDto(existing, _agingDays);
    }

    public async Task<TaskDto?> UpdateStatusAsync(int id, UpdateTaskStatusRequest request)
    {
        var existing = await _tasks.GetByIdAsync(id);
        if (existing is null)
        {
            return null;
        }

        var status = request.Status.Trim();
        var reason = string.IsNullOrWhiteSpace(request.StuckReason) ? null : request.StuckReason.Trim();

        if (reason is not null && reason == StuckReasons.NoLongerMatters && string.IsNullOrWhiteSpace(status))
        {
            status = TaskStatuses.Done;
        }

        if (reason == StuckReasons.NoLongerMatters && !status.Equals(TaskStatuses.Stuck, StringComparison.OrdinalIgnoreCase))
        {
            status = TaskStatuses.Done;
        }

        if (!TaskStatuses.All.Contains(status))
        {
            throw new ArgumentException("Invalid status.");
        }

        if (status.Equals(TaskStatuses.Stuck, StringComparison.OrdinalIgnoreCase))
        {
            if (reason is null || !StuckReasons.All.Contains(reason))
            {
                throw new ArgumentException("A valid stuckReason is required when status is Stuck.");
            }
        }

        if (reason is not null && !StuckReasons.All.Contains(reason))
        {
            throw new ArgumentException("Invalid stuckReason.");
        }

        ApplyStatus(existing, status, reason);
        existing.UpdatedAt = TaskMapping.Now();
        await _tasks.UpdateAsync(existing);
        return TaskMapping.ToDto(existing, _agingDays);
    }

    public Task<bool> DeleteAsync(int id) => _tasks.DeleteAsync(id);

    public async Task<IReadOnlyList<SimilarTaskDto>> GetSimilarTasksAsync(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return [];
        }

        var done = await _tasks.ListDoneAsync();
        return done
            .Select(task => new SimilarTaskDto
            {
                Id = task.Id,
                Title = task.Title,
                DoneAt = task.DoneAt,
                Similarity = FuzzyMatcher.Score(title, task.Title)
            })
            .Where(match => match.Similarity >= _similarityThreshold)
            .OrderByDescending(match => match.Similarity)
            .Take(5)
            .ToList();
    }

    public async Task<TimelineEntryDto?> AddTimelineAsync(int taskId, string note)
    {
        var existing = await _tasks.GetByIdAsync(taskId);
        if (existing is null)
        {
            return null;
        }

        var trimmed = note.Trim();
        if (trimmed.Length == 0)
        {
            throw new ArgumentException("Note is required.");
        }

        var now = TaskMapping.Now();
        var entry = await _tasks.AddTimelineAsync(taskId, trimmed, now);
        existing.UpdatedAt = now;
        await _tasks.UpdateAsync(existing);
        return TaskMapping.ToDto(entry);
    }

    public async Task<IReadOnlyList<TimelineEntryDto>> ListTimelineAsync(int taskId)
    {
        var existing = await _tasks.GetByIdAsync(taskId);
        if (existing is null)
        {
            return [];
        }

        var rows = await _tasks.ListTimelineAsync(taskId);
        return rows.Select(TaskMapping.ToDto).ToList();
    }

    public async Task<IReadOnlyList<TaskDto>> ListRelatedToDateAsync(string logDate)
    {
        var rows = await _tasks.ListRelatedToDateAsync(logDate);
        return rows.Select(r => TaskMapping.ToDto(r, _agingDays)).ToList();
    }

    private static void ApplyStatus(TaskRecord task, string status, string? stuckReason)
    {
        task.Status = status;
        if (status.Equals(TaskStatuses.Done, StringComparison.OrdinalIgnoreCase))
        {
            task.DoneAt ??= TaskMapping.Now();
            task.StuckReason = stuckReason ?? task.StuckReason;
        }
        else
        {
            task.DoneAt = null;
            task.StuckReason = status.Equals(TaskStatuses.Stuck, StringComparison.OrdinalIgnoreCase)
                ? stuckReason
                : stuckReason ?? task.StuckReason;
        }
    }
}

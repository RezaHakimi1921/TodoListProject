using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class TaskReminderService : ITaskReminderService
{
    private readonly ITaskReminderRepository _reminders;
    private readonly ITaskRepository _tasks;
    private readonly IJiraCommentInboxService _inbox;

    public TaskReminderService(
        ITaskReminderRepository reminders,
        ITaskRepository tasks,
        IJiraCommentInboxService inbox)
    {
        _reminders = reminders;
        _tasks = tasks;
        _inbox = inbox;
    }

    public async Task<IReadOnlyList<TaskReminderDto>> ListByTaskAsync(int taskId)
    {
        var rows = await _reminders.ListByTaskAsync(taskId);
        return rows.Select(ToDto).ToList();
    }

    public async Task AttachAsync(IReadOnlyList<TaskDto> dtos)
    {
        if (dtos.Count == 0) return;
        var ids = dtos.Select(d => d.Id).ToArray();
        var next = await _reminders.NextRemindAtByTaskIdsAsync(ids);
        var counts = await _reminders.PendingCountByTaskIdsAsync(ids);
        var unread = await _inbox.UnreadReminderCountsByTaskIdsAsync(ids);
        foreach (var dto in dtos)
        {
            if (next.TryGetValue(dto.Id, out var at)) dto.NextReminderAt = at;
            if (counts.TryGetValue(dto.Id, out var count)) dto.ReminderCount = count;
            if (unread.TryGetValue(dto.Id, out var unreadCount)) dto.UnreadReminderCount = unreadCount;
        }
    }

    public async Task<TaskReminderDto?> CreateAsync(int taskId, CreateTaskReminderRequest request)
    {
        var task = await _tasks.GetByIdAsync(taskId);
        if (task is null) return null;

        if (!DateTime.TryParse(request.RemindAt, out var at))
        {
            throw new ArgumentException("زمان یادآوری معتبر نیست");
        }

        var utc = at.Kind switch
        {
            DateTimeKind.Utc => at,
            DateTimeKind.Local => at.ToUniversalTime(),
            _ => DateTime.SpecifyKind(at, DateTimeKind.Local).ToUniversalTime(),
        };

        if (utc <= DateTime.UtcNow.AddMinutes(-1))
        {
            throw new ArgumentException("زمان یادآوری باید در آینده باشد");
        }

        var row = await _reminders.CreateAsync(new TaskReminder
        {
            TaskId = taskId,
            RemindAt = utc.ToString("o"),
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            CreatedAt = TaskMapping.Now(),
        });
        return ToDto(row);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var row = await _reminders.GetAsync(id);
        if (row is null) return false;
        await _reminders.DeleteAsync(id);
        return true;
    }


    public async Task<IReadOnlyList<TaskReminderDto>> ListPendingAsync()
    {
        var rows = await _reminders.ListPendingAsync();
        return rows.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<TaskReminderDto>> ListFiredAsync(int limit = 50)
    {
        var rows = await _reminders.ListFiredAsync(limit);
        return rows.Select(ToDto).ToList();
    }

    public async Task<TaskReminderDto?> UpdateAsync(int id, CreateTaskReminderRequest request)
    {
        var existing = await _reminders.GetAsync(id);
        if (existing is null || !string.IsNullOrWhiteSpace(existing.FiredAt)) return null;

        if (!DateTime.TryParse(request.RemindAt, out var at))
        {
            throw new ArgumentException("زمان یادآوری معتبر نیست");
        }

        var utc = at.Kind switch
        {
            DateTimeKind.Utc => at,
            DateTimeKind.Local => at.ToUniversalTime(),
            _ => DateTime.SpecifyKind(at, DateTimeKind.Local).ToUniversalTime(),
        };

        if (utc <= DateTime.UtcNow.AddMinutes(-1))
        {
            throw new ArgumentException("زمان یادآوری باید در آینده باشد");
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        var ok = await _reminders.UpdateAsync(id, utc.ToString("o"), note);
        if (!ok) return null;
        var row = await _reminders.GetAsync(id);
        return row is null ? null : ToDto(row);
    }

    public async Task FireDueAsync(CancellationToken cancellationToken = default)
    {
        var due = await _reminders.ListDueAsync(DateTime.UtcNow.ToString("o"));
        foreach (var item in due)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var firedAt = TaskMapping.Now();
            await _reminders.MarkFiredAsync(item.Id, firedAt);

            var title = string.IsNullOrWhiteSpace(item.TaskTitle) ? "یادآوری تسک" : item.TaskTitle!;
            var body = string.IsNullOrWhiteSpace(item.Note) ? "زمان یادآوری این تسک رسیده است." : item.Note!;
            var jiraKey = string.IsNullOrWhiteSpace(item.JiraKey) ? $"TASK-{item.TaskId}" : item.JiraKey!;

            // Push once via inbox relay / AddIncoming — do not double-send here.
            await _inbox.AddIncomingAsync(
                item.TaskId,
                jiraKey,
                $"reminder:{item.Id}",
                "یادآوری",
                body,
                firedAt,
                sendPush: false);
        }
    }

    private static TaskReminderDto ToDto(TaskReminder row) => new()
    {
        Id = row.Id,
        TaskId = row.TaskId,
        RemindAt = row.RemindAt,
        Note = row.Note,
        CreatedAt = row.CreatedAt,
        FiredAt = row.FiredAt,
        TaskTitle = row.TaskTitle,
        JiraKey = row.JiraKey,
    };
}
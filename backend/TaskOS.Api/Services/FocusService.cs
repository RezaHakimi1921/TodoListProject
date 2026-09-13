using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;

namespace TaskOS.Api.Services;

public sealed class FocusService : IFocusService
{
    private readonly SqliteConnectionFactory _factory;
    private readonly IWorkLogService _workLogs;
    private readonly ITaskService _tasks;
    private readonly ISettingsService _settings;

    public FocusService(SqliteConnectionFactory factory, IWorkLogService workLogs, ITaskService tasks, ISettingsService settings)
    {
        _factory = factory;
        _workLogs = workLogs;
        _tasks = tasks;
        _settings = settings;
    }

    public async Task<WorkFocusDto> GetAsync()
    {
        int? resumeDoneId = null;
        WorkFocusDto dto;
        using (var connection = _factory.Create())
        {
            var row = await connection.QuerySingleOrDefaultAsync<FocusRow>(
                "SELECT Description, TaskId, ProblemId, StartedAt, UpdatedAt, Active FROM WorkFocus WHERE Id = 1");
            dto = Map(row);
            dto.IsResting = await _settings.IsRestingAsync();
            dto.Note = await _settings.GetRestNoteAsync();
            if (dto.Active
                && DateTime.TryParse(dto.StartedAt, out var leftoverStart)
                && TaskMapping.StartedOnPriorLocalDay(leftoverStart))
            {
                var now = TaskMapping.Now();
                await connection.ExecuteAsync(
                    "UPDATE WorkFocus SET StartedAt = @Now, UpdatedAt = @Now WHERE Id = 1",
                    new { Now = now });
                dto.StartedAt = now;
            }
            if (dto.IsResting && dto.TaskId is int restTaskId)
            {
                await MarkActivityDoingAsync(restTaskId);
            }
            if (dto.IsResting && string.IsNullOrWhiteSpace(dto.Description))
            {
                dto.Description = "استراحت";
                dto.Active = true;
            }
            else if (dto.Active && !dto.IsResting && dto.ProblemId is int focusedProblemId && dto.TaskId is null)
            {
                var problemTitle = await connection.QuerySingleOrDefaultAsync<string>(
                    "SELECT Title FROM Problem WHERE Id = @Id AND DeletedAt IS NULL", new { Id = focusedProblemId });
                if (!string.IsNullOrWhiteSpace(problemTitle))
                {
                    dto.Description = problemTitle;
                }
            }
            else if (dto.Active && !dto.IsResting && dto.TaskId is int taskId)
            {
                var status = await connection.QuerySingleOrDefaultAsync<string>(
                    "SELECT Status FROM Task WHERE Id = @Id AND DeletedAt IS NULL", new { Id = taskId });
                if (string.Equals(status, "Done", StringComparison.OrdinalIgnoreCase))
                {
                    await LogElapsedWorkAsync(dto, WorkLogSources.Timer);
                    await connection.ExecuteAsync(
                        "UPDATE WorkFocus SET Active = 0, UpdatedAt = @Now WHERE Id = 1",
                        new { Now = TaskMapping.Now() });
                    dto.Active = false;
                    dto.Description = string.Empty;
                    dto.TaskId = null;
                    resumeDoneId = taskId;
                }
                else
                {
                    var title = await connection.QuerySingleOrDefaultAsync<string>(
                        "SELECT Title FROM Task WHERE Id = @Id AND DeletedAt IS NULL", new { Id = taskId });
                    if (!string.IsNullOrWhiteSpace(title))
                    {
                        dto.Description = title;
                        if (IsBrokenDescription(row?.Description))
                        {
                            await connection.ExecuteAsync(
                                "UPDATE WorkFocus SET Description = @Title WHERE Id = 1",
                                new { Title = title });
                        }
                    }
                }
            }
        }

        if (resumeDoneId is int doneId)
        {
            var resumed = await ResumePreviousFocusAsync(doneId);
            if (resumed is not null)
            {
                return resumed;
            }
        }

        return dto;
    }

    public async Task<WorkFocusDto> SetAsync(SetFocusRequest request)
    {
        var current = await GetAsync();
        if (current.IsResting)
        {
            await _settings.SetRestingAsync(false);
        }
        else
        {
            await TryLogOutgoingFocusAsync(current, request);
        }

        var description = await ResolveFocusDescriptionAsync(request);
        var now = TaskMapping.Now();
        using var connection = _factory.Create();
        await connection.ExecuteAsync("""
            INSERT INTO WorkFocus (Id, Description, TaskId, ProblemId, StartedAt, UpdatedAt, Active)
            VALUES (1, @Description, @TaskId, @ProblemId, @Now, @Now, 1)
            ON CONFLICT(Id) DO UPDATE SET
                Description = excluded.Description,
                TaskId = excluded.TaskId,
                ProblemId = excluded.ProblemId,
                StartedAt = excluded.StartedAt,
                UpdatedAt = excluded.UpdatedAt,
                Active = 1
            """, new { Description = description, TaskId = request.TaskId, ProblemId = request.ProblemId, Now = now });

        if (request.TaskId is int startedId)
        {
            var started = await _tasks.GetAsync(startedId);
            if (started is not null && !string.Equals(started.Status, "Done", StringComparison.OrdinalIgnoreCase))
            {
                await _tasks.UpdateStatusAsync(startedId, new UpdateTaskStatusRequest { Status = "Doing" });
            }
        }

        return await GetAsync();
    }

    public async Task<WorkFocusDto> TickAsync(FocusActionRequest request)
    {
        var focus = await GetAsync();
        if (!focus.Active)
        {
            throw new InvalidOperationException("کار فعالی برای ادامه وجود ندارد.");
        }

        await LogElapsedWorkAsync(focus, request.Source);
        var now = TaskMapping.Now();
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkFocus SET StartedAt = @Now, UpdatedAt = @Now WHERE Id = 1",
            new { Now = now });
        return await GetAsync();
    }

    public async Task<WorkFocusDto> FinishAsync(FocusActionRequest request)
    {
        var focus = await GetAsync();
        if (focus.Active && !focus.IsResting)
        {
            await LogElapsedWorkAsync(focus, request.Source);
        }

        var taskId = request.TaskId ?? focus.TaskId;
        if (request.MarkTaskDone && taskId is int id)
        {
            await _tasks.UpdateStatusAsync(id, new UpdateTaskStatusRequest { Status = "Done" });
        }

        await _settings.SetRestingAsync(false);
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkFocus SET Active = 0, UpdatedAt = @Now WHERE Id = 1",
            new { Now = TaskMapping.Now() });
        return await GetAsync();
    }

    public async Task<WorkFocusDto> ClearAsync()
    {
        var focus = await GetAsync();
        if (focus.Active && !focus.IsResting)
        {
            await LogElapsedWorkAsync(focus, WorkLogSources.Timer);
        }

        await _settings.SetRestingAsync(false);
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkFocus SET Active = 0, UpdatedAt = @Now WHERE Id = 1",
            new { Now = TaskMapping.Now() });
        return await GetAsync();
    }

    public async Task<WorkFocusDto> StartRestAsync(string? description = null, int? activityTaskId = null, string? note = null)
    {
        var focus = await GetAsync();
        if (!focus.IsResting)
        {
            if (focus.Active)
            {
                await LogElapsedWorkAsync(focus, WorkLogSources.Timer);
            }

            await _settings.SaveRestResumeAsync(
                focus.Active ? focus.TaskId : null,
                focus.Active ? focus.ProblemId : null,
                focus.Active ? focus.Description : string.Empty);
            await _settings.SetRestingAsync(true);
            var settings = await _settings.GetAsync();
            await _settings.UpdateAsync(new AppSettingsDto { PingMinutes = settings.PingMinutes, Paused = true });
        }

        else if (focus.TaskId is int previousRest && previousRest != activityTaskId)
        {
            await ReopenActivityAsync(previousRest);
        }

        var title = string.IsNullOrWhiteSpace(description) ? "استراحت" : description.Trim();
        var now = TaskMapping.Now();
        using var connection = _factory.Create();
        await connection.ExecuteAsync("""
            INSERT INTO WorkFocus (Id, Description, TaskId, ProblemId, StartedAt, UpdatedAt, Active)
            VALUES (1, @Description, @TaskId, NULL, @Now, @Now, 1)
            ON CONFLICT(Id) DO UPDATE SET
                Description = excluded.Description,
                TaskId = excluded.TaskId,
                ProblemId = NULL,
                StartedAt = excluded.StartedAt,
                UpdatedAt = excluded.UpdatedAt,
                Active = 1
            """, new { Description = title, TaskId = activityTaskId, Now = now });
        if (!string.IsNullOrWhiteSpace(note))
        {
            await _settings.SetRestNoteAsync(note);
        }
        else if (!focus.IsResting)
        {
            await _settings.SetRestNoteAsync(null);
        }
        if (activityTaskId is int startedId)
        {
            await MarkActivityDoingAsync(startedId);
        }
        await PauseOtherDoingAsync(activityTaskId);
        return await GetAsync();
    }

    public async Task<WorkFocusDto> SaveRestNoteAsync(string? note)
    {
        await _settings.SetRestNoteAsync(note);
        return await GetAsync();
    }

    public async Task<WorkFocusDto> EndRestAsync(string? note = null)
    {
        var focus = await GetAsync();
        if (focus.IsResting && !string.IsNullOrWhiteSpace(focus.StartedAt)
            && DateTime.TryParse(focus.StartedAt, out var started))
        {
            var minutes = SameDayLogMinutes(started);
            if (minutes is >= 1 and <= 480)
            {
                var storedNote = string.IsNullOrWhiteSpace(note) ? focus.Note : note.Trim();
                if (string.IsNullOrWhiteSpace(storedNote))
                {
                    storedNote = await _settings.GetRestNoteAsync();
                }
                var label = string.IsNullOrWhiteSpace(focus.Description) ? "استراحت" : focus.Description.Trim();
                var description = string.IsNullOrWhiteSpace(storedNote)
                    ? label
                    : label + " — " + storedNote.Trim();
                await _workLogs.CaptureAsync(new CaptureWorkLogRequest
                {
                    Description = description,
                    DurationMinutes = minutes,
                    Source = WorkLogSources.Break,
                    TaskId = focus.TaskId
                });
            }
        }

        if (focus.TaskId is int endedId)
        {
            await ReopenActivityAsync(endedId);
        }
        await _settings.SetRestNoteAsync(null);
        var resume = await _settings.ConsumeRestResumeAsync();
        if (!string.IsNullOrWhiteSpace(resume.Description))
        {
            return await SetAsync(new SetFocusRequest
            {
                Description = resume.Description,
                TaskId = resume.TaskId,
                ProblemId = resume.ProblemId,
                Log = false
            });
        }

        return await ClearAsync();
    }

    public Task FlushElapsedSliceAsync()
    {
        // Time stays on StartedAt until the user leaves the task (Set/Finish/Clear/Rest).
        return Task.CompletedTask;
    }

    public async Task FlushElapsedForTaskAsync(int taskId)
    {
        var focus = await GetAsync();
        if (focus.IsResting)
        {
            return;
        }

        if (!focus.Active || focus.TaskId != taskId)
        {
            return;
        }

        await LogElapsedWorkAsync(focus, WorkLogSources.Timer);
        await _settings.SetRestingAsync(false);
        using (var connection = _factory.Create())
        {
            await connection.ExecuteAsync(
                "UPDATE WorkFocus SET Active = 0, UpdatedAt = @Now WHERE Id = 1",
                new { Now = TaskMapping.Now() });
        }

        await ResumePreviousFocusAsync(taskId);
    }

    private async Task<WorkFocusDto?> ResumePreviousFocusAsync(int doneTaskId)
    {
        var previous = await PickPreviousFocusTaskAsync(doneTaskId);
        if (previous is null)
        {
            return null;
        }

        return await SetAsync(new SetFocusRequest
        {
            Description = previous.Title,
            TaskId = previous.Id,
            Log = false
        });
    }

    private async Task<TaskDto?> PickPreviousFocusTaskAsync(int doneTaskId)
    {
        var tasks = await _tasks.ListAsync(null, null, null);
        var candidates = tasks.Where(task =>
            task.Id != doneTaskId
            && !string.Equals(task.Status, TaskStatuses.Done, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(task.Ownership, TaskOwnerships.Other, StringComparison.OrdinalIgnoreCase)
            && !IsResumeSkipTask(task.JiraKey)).ToList();

        var paused = candidates
            .Where(task =>
                string.Equals(task.Status, TaskStatuses.Stuck, StringComparison.OrdinalIgnoreCase)
                && string.Equals(task.StuckReason, StuckReasons.Forgot, StringComparison.Ordinal))
            .OrderByDescending(UpdatedAtValue)
            .FirstOrDefault();
        if (paused is not null)
        {
            return paused;
        }

        return candidates
            .Where(task => string.Equals(task.Status, TaskStatuses.Doing, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(UpdatedAtValue)
            .FirstOrDefault();
    }

    private static bool IsResumeSkipTask(string? jiraKey)
    {
        if (ActivityJira.IsActivity(jiraKey))
        {
            return true;
        }

        return string.Equals(
            (jiraKey ?? string.Empty).Trim(),
            ActivityJira.NotificationKey,
            StringComparison.OrdinalIgnoreCase);
    }

    private static DateTime UpdatedAtValue(TaskDto task) =>
        DateTime.TryParse(task.UpdatedAt, out var value) ? value : DateTime.MinValue;

    private async Task MarkActivityDoingAsync(int taskId)
    {
        var task = await _tasks.GetAsync(taskId);
        if (task is null || !ActivityJira.IsActivity(task.JiraKey))
        {
            return;
        }

        if (!string.Equals(task.Status, TaskStatuses.Doing, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(task.Status, TaskStatuses.Done, StringComparison.OrdinalIgnoreCase))
        {
            await _tasks.UpdateStatusAsync(taskId, new UpdateTaskStatusRequest { Status = TaskStatuses.Doing });
        }
    }

    private async Task ReopenActivityAsync(int taskId)
    {
        var task = await _tasks.GetAsync(taskId);
        if (task is null || !ActivityJira.IsActivity(task.JiraKey))
        {
            return;
        }

        if (string.Equals(task.Status, TaskStatuses.Doing, StringComparison.OrdinalIgnoreCase))
        {
            await _tasks.UpdateStatusAsync(taskId, new UpdateTaskStatusRequest { Status = TaskStatuses.Open });
        }
    }

    private async Task PauseOtherDoingAsync(int? keepTaskId)
    {
        var tasks = await _tasks.ListAsync(null, null, null);
        foreach (var task in tasks)
        {
            if (keepTaskId is int keep && task.Id == keep)
            {
                continue;
            }

            if (!string.Equals(task.Status, TaskStatuses.Doing, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (ActivityJira.IsActivity(task.JiraKey))
            {
                await ReopenActivityAsync(task.Id);
                continue;
            }

            await _tasks.UpdateStatusAsync(task.Id, new UpdateTaskStatusRequest
            {
                Status = TaskStatuses.Stuck,
                StuckReason = StuckReasons.Forgot
            });
        }
    }

    private async Task TryLogOutgoingFocusAsync(WorkFocusDto current, SetFocusRequest next)
    {
        if (!current.Active || current.IsResting)
        {
            return;
        }

        if (current.TaskId is null && current.ProblemId is null)
        {
            return;
        }

        var sameTarget = current.TaskId == next.TaskId && current.ProblemId == next.ProblemId;
        if (sameTarget)
        {
            return;
        }

        await LogElapsedWorkAsync(current, WorkLogSources.Timer);
    }

    private async Task LogElapsedWorkAsync(WorkFocusDto focus, string? source)
    {
        if (!focus.Active || focus.IsResting)
        {
            return;
        }

        if (focus.TaskId is null && focus.ProblemId is null)
        {
            return;
        }

        var minutes = SliceMinutes(focus);
        if (minutes < 1)
        {
            return;
        }

        await _workLogs.CaptureAsync(new CaptureWorkLogRequest
        {
            Description = focus.Description,
            DurationMinutes = minutes,
            Source = string.IsNullOrWhiteSpace(source) ? WorkLogSources.Timer : source.Trim(),
            TaskId = focus.TaskId,
            ProblemId = focus.ProblemId
        });
    }

    private static int SliceMinutes(WorkFocusDto focus)
    {
        if (string.IsNullOrWhiteSpace(focus.StartedAt) || !DateTime.TryParse(focus.StartedAt, out var started))
        {
            return 0;
        }

        return SameDayLogMinutes(started);
    }

    private static int SameDayLogMinutes(DateTime started)
    {
        if (TaskMapping.StartedOnPriorLocalDay(started))
        {
            return 0;
        }

        var elapsed = ElapsedMinutes(started);
        if (elapsed < 1)
        {
            return 0;
        }

        return ClampLogMinutes(elapsed);
    }

    private static bool IsBrokenDescription(string? value)
    {
        var text = (value ?? string.Empty).Trim();
        if (text.Length == 0) return true;
        if (text.All(ch => ch == '?' || char.IsWhiteSpace(ch))) return true;
        if (text.Contains("jira.smartx.ir", StringComparison.OrdinalIgnoreCase)
            || text.Contains("://", StringComparison.OrdinalIgnoreCase)
            || text.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }

    private async Task<string> ResolveFocusDescriptionAsync(SetFocusRequest request)
    {
        if (request.TaskId is int taskId)
        {
            var task = await _tasks.GetAsync(taskId);
            if (task is not null && !string.IsNullOrWhiteSpace(task.Title))
            {
                return task.Title.Trim();
            }
        }

        if (request.ProblemId is int problemId)
        {
            using var connection = _factory.Create();
            var problemTitle = await connection.QuerySingleOrDefaultAsync<string>(
                "SELECT Title FROM Problem WHERE Id = @Id AND DeletedAt IS NULL", new { Id = problemId });
            if (!string.IsNullOrWhiteSpace(problemTitle))
            {
                return problemTitle.Trim();
            }
        }

        return Require(request.Description, "Description is required.");
    }

    private static int ElapsedMinutes(DateTime started)
    {
        var startedUtc = started.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(started, DateTimeKind.Utc)
            : started.ToUniversalTime();
        return (int)Math.Round((DateTime.UtcNow - startedUtc).TotalMinutes);
    }

    private static int ClampLogMinutes(int minutes)
    {
        if (minutes < 1) return 1;
        if (minutes > 480) return 480;
        return minutes;
    }

    private static WorkFocusDto Map(FocusRow? row)
    {
        if (row is null || row.Active == 0 || string.IsNullOrWhiteSpace(row.Description))
        {
            return new WorkFocusDto { Active = false };
        }

        return new WorkFocusDto
        {
            Active = true,
            Description = row.Description,
            TaskId = row.TaskId,
            ProblemId = row.ProblemId,
            StartedAt = row.StartedAt,
            UpdatedAt = row.UpdatedAt
        };
    }

    private static string Require(string? value, string message)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (trimmed.Length == 0) throw new ArgumentException(message);
        return trimmed;
    }

    private sealed class FocusRow
    {
        public string Description { get; set; } = string.Empty;
        public int? TaskId { get; set; }
        public int? ProblemId { get; set; }
        public string? StartedAt { get; set; }
        public string? UpdatedAt { get; set; }
        public int Active { get; set; }
    }
}

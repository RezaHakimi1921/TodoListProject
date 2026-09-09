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
        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<FocusRow>(
            "SELECT Description, TaskId, ProblemId, StartedAt, UpdatedAt, Active FROM WorkFocus WHERE Id = 1");
        var dto = Map(row);
        dto.IsResting = await _settings.IsRestingAsync();
        if (dto.IsResting && string.IsNullOrWhiteSpace(dto.Description))
        {
            dto.Description = "استراحت";
            dto.Active = true;
        }
        else if (dto.Active && !dto.IsResting && dto.TaskId is int taskId)
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

    public async Task<WorkFocusDto> StartRestAsync(string? description = null)
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

        var title = string.IsNullOrWhiteSpace(description) ? "استراحت" : description.Trim();
        var now = TaskMapping.Now();
        using var connection = _factory.Create();
        await connection.ExecuteAsync("""
            INSERT INTO WorkFocus (Id, Description, TaskId, ProblemId, StartedAt, UpdatedAt, Active)
            VALUES (1, @Description, NULL, NULL, @Now, @Now, 1)
            ON CONFLICT(Id) DO UPDATE SET
                Description = excluded.Description,
                TaskId = NULL,
                ProblemId = NULL,
                StartedAt = excluded.StartedAt,
                UpdatedAt = excluded.UpdatedAt,
                Active = 1
            """, new { Description = title, Now = now });
        return await GetAsync();
    }

    public async Task<WorkFocusDto> EndRestAsync()
    {
        var focus = await GetAsync();
        if (focus.IsResting && !string.IsNullOrWhiteSpace(focus.StartedAt)
            && DateTime.TryParse(focus.StartedAt, out var started))
        {
            var minutes = ClampLogMinutes(ElapsedMinutes(started));
            if (minutes is >= 1 and <= 480)
            {
                await _workLogs.CaptureAsync(new CaptureWorkLogRequest
                {
                    Description = string.IsNullOrWhiteSpace(focus.Description) ? "استراحت" : focus.Description,
                    DurationMinutes = minutes,
                    Source = WorkLogSources.Break
                });
            }
        }

        await _settings.SetRestingAsync(false);
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

    public async Task FlushElapsedSliceAsync()
    {
        var focus = await GetAsync();
        if (!focus.Active || focus.IsResting)
        {
            return;
        }

        if (focus.TaskId is null && focus.ProblemId is null)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(focus.StartedAt) || !DateTime.TryParse(focus.StartedAt, out var started))
        {
            return;
        }

        var elapsed = ElapsedMinutes(started);
        var ping = Math.Max(1, (await _settings.GetAsync()).PingMinutes);
        if (elapsed < ping)
        {
            return;
        }

        await TickAsync(new FocusActionRequest
        {
            DurationMinutes = elapsed,
            Source = WorkLogSources.Timer
        });
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
        if (!string.IsNullOrWhiteSpace(focus.StartedAt) && DateTime.TryParse(focus.StartedAt, out var started))
        {
            var elapsed = ElapsedMinutes(started);
            if (elapsed >= 1)
            {
                return ClampLogMinutes(elapsed);
            }
        }

        return 1;
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

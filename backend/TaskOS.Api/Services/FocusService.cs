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
        return dto;
    }

    public async Task<WorkFocusDto> SetAsync(SetFocusRequest request)
    {
        if (await _settings.IsRestingAsync())
        {
            await _settings.SetRestingAsync(false);
        }

        var description = Require(request.Description, "Description is required.");
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

        if (request.Log)
        {
            await _workLogs.CaptureAsync(new CaptureWorkLogRequest
            {
                Description = description,
                DurationMinutes = request.DurationMinutes ?? 15,
                Source = request.Source,
                TaskId = request.TaskId,
                ProblemId = request.ProblemId
            });
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

        await LogFocusSlice(focus, request);
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkFocus SET UpdatedAt = @Now WHERE Id = 1",
            new { Now = TaskMapping.Now() });
        return await GetAsync();
    }

    public async Task<WorkFocusDto> FinishAsync(FocusActionRequest request)
    {
        var focus = await GetAsync();
        if (focus.Active && !focus.IsResting)
        {
            await LogFocusSlice(focus, request);
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
            var startedUtc = started.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(started, DateTimeKind.Utc)
                : started.ToUniversalTime();
            var minutes = (int)Math.Round((DateTime.UtcNow - startedUtc).TotalMinutes);
            if (minutes >= 1 && minutes <= 480)
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

    private Task LogFocusSlice(WorkFocusDto focus, FocusActionRequest request) =>
        _workLogs.CaptureAsync(new CaptureWorkLogRequest
        {
            Description = focus.Description,
            DurationMinutes = request.DurationMinutes ?? 15,
            Source = request.Source,
            TaskId = focus.TaskId,
            ProblemId = focus.ProblemId
        });

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

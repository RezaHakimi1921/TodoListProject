using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public sealed class FocusService : IFocusService
{
    private readonly SqliteConnectionFactory _factory;
    private readonly IWorkLogService _workLogs;
    private readonly ITaskService _tasks;

    public FocusService(SqliteConnectionFactory factory, IWorkLogService workLogs, ITaskService tasks)
    {
        _factory = factory;
        _workLogs = workLogs;
        _tasks = tasks;
    }

    public async Task<WorkFocusDto> GetAsync()
    {
        using var connection = _factory.Create();
        var row = await connection.QuerySingleOrDefaultAsync<FocusRow>(
            "SELECT Description, TaskId, ProblemId, StartedAt, UpdatedAt, Active FROM WorkFocus WHERE Id = 1");
        return Map(row);
    }

    public async Task<WorkFocusDto> SetAsync(SetFocusRequest request)
    {
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
        if (focus.Active)
        {
            await LogFocusSlice(focus, request);
        }

        var taskId = request.TaskId ?? focus.TaskId;
        if (request.MarkTaskDone && taskId is int id)
        {
            await _tasks.UpdateStatusAsync(id, new UpdateTaskStatusRequest { Status = "Done" });
        }

        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkFocus SET Active = 0, UpdatedAt = @Now WHERE Id = 1",
            new { Now = TaskMapping.Now() });
        return await GetAsync();
    }

    public async Task<WorkFocusDto> ClearAsync()
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkFocus SET Active = 0, UpdatedAt = @Now WHERE Id = 1",
            new { Now = TaskMapping.Now() });
        return await GetAsync();
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

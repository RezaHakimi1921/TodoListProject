using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class TaskRepository : ITaskRepository
{
    private readonly SqliteConnectionFactory _factory;

    public TaskRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<TaskRecord>> ListAsync(string? status, string? energyType, string? tag, string? date = null, string? q = null)
    {
        var sql = """
            SELECT Id, Title, Status, EnergyType, Tags, StuckReason, CreatedAt, UpdatedAt, DoneAt
            FROM Task
            WHERE DeletedAt IS NULL
              AND (@Status IS NULL OR Status = @Status)
              AND (@EnergyType IS NULL OR EnergyType = @EnergyType)
              AND (@Tag IS NULL OR (',' || IFNULL(Tags, '') || ',') LIKE '%,' || @Tag || ',%')
              AND (@Q IS NULL OR Title LIKE '%' || @Q || '%' OR IFNULL(Tags, '') LIKE '%' || @Q || '%')
              AND (
                    @Date IS NULL
                    OR @Q IS NOT NULL
                    OR Status != 'Done'
                    OR date(DoneAt) = @Date
                  )
            ORDER BY
                CASE Status WHEN 'Doing' THEN 0 WHEN 'Open' THEN 1 WHEN 'Stuck' THEN 2 ELSE 3 END,
                UpdatedAt DESC
            """;

        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskRecord>(sql, new
        {
            Status = string.IsNullOrWhiteSpace(status) ? null : status,
            EnergyType = string.IsNullOrWhiteSpace(energyType) ? null : energyType,
            Tag = string.IsNullOrWhiteSpace(tag) ? null : tag.Trim(),
            Date = string.IsNullOrWhiteSpace(date) ? null : date,
            Q = string.IsNullOrWhiteSpace(q) ? null : q.Trim()
        });
        return rows.ToList();
    }

    public async Task<TaskRecord?> GetByIdAsync(int id)
    {
        const string sql = """
            SELECT Id, Title, Status, EnergyType, Tags, StuckReason, CreatedAt, UpdatedAt, DoneAt
            FROM Task
            WHERE Id = @Id AND DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<TaskRecord>(sql, new { Id = id });
    }

    public async Task<IReadOnlyList<TaskRecord>> ListDoneAsync()
    {
        const string sql = """
            SELECT Id, Title, Status, EnergyType, Tags, StuckReason, CreatedAt, UpdatedAt, DoneAt
            FROM Task
            WHERE Status = 'Done' AND DeletedAt IS NULL
            ORDER BY DoneAt DESC, UpdatedAt DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskRecord>(sql);
        return rows.ToList();
    }

    public async Task<int> CreateAsync(TaskRecord task)
    {
        const string sql = """
            INSERT INTO Task (Title, Status, EnergyType, Tags, StuckReason, CreatedAt, UpdatedAt, DoneAt)
            VALUES (@Title, @Status, @EnergyType, @Tags, @StuckReason, @CreatedAt, @UpdatedAt, @DoneAt);
            SELECT last_insert_rowid();
            """;
        using var connection = _factory.Create();
        return await connection.ExecuteScalarAsync<int>(sql, task);
    }

    public async Task<bool> UpdateAsync(TaskRecord task)
    {
        const string sql = """
            UPDATE Task
            SET Title = @Title,
                Status = @Status,
                EnergyType = @EnergyType,
                Tags = @Tags,
                StuckReason = @StuckReason,
                UpdatedAt = @UpdatedAt,
                DoneAt = @DoneAt
            WHERE Id = @Id AND DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.ExecuteAsync(sql, task) > 0;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var connection = _factory.Create();
        return await connection.ExecuteAsync(
            "UPDATE Task SET DeletedAt = @Now, UpdatedAt = @Now WHERE Id = @Id AND DeletedAt IS NULL",
            new { Id = id, Now = TaskOS.Api.Services.TaskMapping.Now() }) > 0;
    }

    public async Task<IReadOnlyList<TaskTimelineEntry>> ListTimelineAsync(int taskId)
    {
        const string sql = """
            SELECT Id, TaskId, Note, CreatedAt
            FROM TaskTimelineEntry
            WHERE TaskId = @TaskId AND DeletedAt IS NULL
            ORDER BY CreatedAt ASC, Id ASC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskTimelineEntry>(sql, new { TaskId = taskId });
        return rows.ToList();
    }

    public async Task<TaskTimelineEntry> AddTimelineAsync(int taskId, string note, string createdAt)
    {
        const string sql = """
            INSERT INTO TaskTimelineEntry (TaskId, Note, CreatedAt)
            VALUES (@TaskId, @Note, @CreatedAt);
            SELECT Id, TaskId, Note, CreatedAt
            FROM TaskTimelineEntry
            WHERE Id = last_insert_rowid();
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleAsync<TaskTimelineEntry>(sql, new
        {
            TaskId = taskId,
            Note = note,
            CreatedAt = createdAt
        });
    }

    public async Task<IReadOnlyList<TaskRecord>> ListRelatedToDateAsync(string logDate)
    {
        const string sql = """
            SELECT DISTINCT t.Id, t.Title, t.Status, t.EnergyType, t.Tags, t.StuckReason,
                   t.CreatedAt, t.UpdatedAt, t.DoneAt
            FROM Task t
            WHERE t.DeletedAt IS NULL
              AND (
                    date(t.CreatedAt) = @LogDate
                 OR date(t.UpdatedAt) = @LogDate
                 OR date(t.DoneAt) = @LogDate
                 OR EXISTS (
                        SELECT 1 FROM TaskTimelineEntry e
                        WHERE e.TaskId = t.Id AND e.DeletedAt IS NULL AND date(e.CreatedAt) = @LogDate
                   )
              )
            ORDER BY t.UpdatedAt DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskRecord>(sql, new { LogDate = logDate });
        return rows.ToList();
    }

    public async Task<TaskRecord?> FindSameTitleOnDayAsync(string title, string day)
    {
        const string sql = """
            SELECT Id, Title, Status, EnergyType, Tags, StuckReason, CreatedAt, UpdatedAt, DoneAt
            FROM Task
            WHERE DeletedAt IS NULL
              AND lower(trim(Title)) = lower(trim(@Title))
              AND date(CreatedAt, '+3 hours', '+30 minutes') = @Day
            LIMIT 1
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<TaskRecord>(sql, new { Title = title, Day = day });
    }

    public async Task<IReadOnlyList<TaskDayCount>> ListDaysAsync()
    {
        const string sql = """
            SELECT date(CreatedAt, '+3 hours', '+30 minutes') AS Day,
                   COUNT(*) AS Total,
                   CAST(SUM(CASE WHEN Status = 'Done' THEN 1 ELSE 0 END) AS INTEGER) AS Done
            FROM Task
            WHERE DeletedAt IS NULL
            GROUP BY date(CreatedAt, '+3 hours', '+30 minutes')
            ORDER BY Day DESC
            LIMIT 90
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskDayCount>(sql);
        return rows.ToList();
    }
}

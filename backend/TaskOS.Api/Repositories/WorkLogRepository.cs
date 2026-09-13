using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class WorkLogRepository : IWorkLogRepository
{
    private const string Columns = "w.Id, w.Description, w.DurationMinutes, w.Source, w.TaskId, w.ProblemId, w.CreatedAt, w.JiraWorklogId, t.Title AS TaskTitle, j.JiraKey AS JiraKey, p.Title AS ProblemTitle";
    private readonly SqliteConnectionFactory _factory;

    public WorkLogRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<WorkLogEntry> CreateAsync(WorkLogEntry entry)
    {
        const string sql = """
            INSERT INTO WorkLogEntry (Description, DurationMinutes, Source, TaskId, ProblemId, CreatedAt, JiraWorklogId)
            VALUES (@Description, @DurationMinutes, @Source, @TaskId, @ProblemId, @CreatedAt, @JiraWorklogId);
            SELECT w.Id, w.Description, w.DurationMinutes, w.Source, w.TaskId, w.ProblemId, w.CreatedAt, w.JiraWorklogId,
                   t.Title AS TaskTitle, j.JiraKey AS JiraKey, p.Title AS ProblemTitle
            FROM WorkLogEntry w
            LEFT JOIN Task t ON t.Id = w.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = w.TaskId
            LEFT JOIN Problem p ON p.Id = w.ProblemId AND p.DeletedAt IS NULL
            WHERE w.Id = last_insert_rowid();
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleAsync<WorkLogEntry>(sql, entry);
    }

    public async Task<IReadOnlyList<WorkLogEntry>> ListByDateAsync(string logDate)
    {
        var sql = $"""
            SELECT {Columns}
            FROM WorkLogEntry w
            LEFT JOIN Task t ON t.Id = w.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = w.TaskId
            LEFT JOIN Problem p ON p.Id = w.ProblemId AND p.DeletedAt IS NULL
            WHERE date(w.CreatedAt) = @LogDate AND w.DeletedAt IS NULL
            ORDER BY w.CreatedAt DESC, w.Id DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<WorkLogEntry>(sql, new { LogDate = logDate });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<WorkLogEntry>> ListByTaskAsync(int taskId)
    {
        var sql = $"""
            SELECT {Columns}
            FROM WorkLogEntry w
            LEFT JOIN Task t ON t.Id = w.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = w.TaskId
            LEFT JOIN Problem p ON p.Id = w.ProblemId AND p.DeletedAt IS NULL
            WHERE w.TaskId = @TaskId AND w.DeletedAt IS NULL
            ORDER BY w.CreatedAt DESC, w.Id DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<WorkLogEntry>(sql, new { TaskId = taskId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<WorkLogEntry>> ListByProblemAsync(int problemId)
    {
        var sql = $"""
            SELECT {Columns}
            FROM WorkLogEntry w
            LEFT JOIN Task t ON t.Id = w.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = w.TaskId
            LEFT JOIN Problem p ON p.Id = w.ProblemId AND p.DeletedAt IS NULL
            WHERE w.ProblemId = @ProblemId AND w.DeletedAt IS NULL
            ORDER BY w.CreatedAt DESC, w.Id DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<WorkLogEntry>(sql, new { ProblemId = problemId });
        return rows.ToList();
    }

    public async Task<WorkLogEntry?> FindRecentAsync(int taskId, string source, TimeSpan window)
    {
        var since = DateTime.UtcNow.Subtract(window).ToString("o");
        var automatic = source.Equals(WorkLogSources.Timer, StringComparison.OrdinalIgnoreCase)
            || source.Equals(WorkLogSources.Extension, StringComparison.OrdinalIgnoreCase);
        var sql = $"""
            SELECT {Columns}
            FROM WorkLogEntry w
            LEFT JOIN Task t ON t.Id = w.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = w.TaskId
            LEFT JOIN Problem p ON p.Id = w.ProblemId AND p.DeletedAt IS NULL
            WHERE w.TaskId = @TaskId AND w.DeletedAt IS NULL AND w.CreatedAt >= @Since
              AND (
                    @Automatic = 1 AND w.Source IN ('Timer', 'Extension')
                    OR @Automatic = 0 AND w.Source = @Source
                  )
            ORDER BY w.Id DESC
            LIMIT 1
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<WorkLogEntry>(sql, new
        {
            TaskId = taskId,
            Source = source,
            Since = since,
            Automatic = automatic ? 1 : 0
        });
    }

    public async Task<WorkLogEntry?> GetByIdAsync(int id)
    {
        var sql = $"""
            SELECT {Columns}
            FROM WorkLogEntry w
            LEFT JOIN Task t ON t.Id = w.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = w.TaskId
            LEFT JOIN Problem p ON p.Id = w.ProblemId AND p.DeletedAt IS NULL
            WHERE w.Id = @Id AND w.DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<WorkLogEntry>(sql, new { Id = id });
    }

    public async Task SetDescriptionAsync(int id, string description)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkLogEntry SET Description = @Description WHERE Id = @Id AND DeletedAt IS NULL",
            new { Id = id, Description = description });
    }
    public async Task SetJiraWorklogIdAsync(int id, string jiraWorklogId)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkLogEntry SET JiraWorklogId = @JiraWorklogId WHERE Id = @Id",
            new { Id = id, JiraWorklogId = jiraWorklogId });
    }

    public async Task AddMinutesAsync(int id, int extra)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkLogEntry SET DurationMinutes = DurationMinutes + @Extra WHERE Id = @Id",
            new { Id = id, Extra = extra });
    }

    public async Task SetDurationMinutesAsync(int id, int minutes)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE WorkLogEntry SET DurationMinutes = @Minutes WHERE Id = @Id AND DeletedAt IS NULL",
            new { Id = id, Minutes = minutes });
    }
}

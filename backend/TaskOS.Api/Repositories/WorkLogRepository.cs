using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class WorkLogRepository : IWorkLogRepository
{
    private const string Columns = "Id, Description, DurationMinutes, Source, TaskId, ProblemId, CreatedAt, JiraWorklogId";
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
            SELECT Id, Description, DurationMinutes, Source, TaskId, ProblemId, CreatedAt, JiraWorklogId
            FROM WorkLogEntry
            WHERE Id = last_insert_rowid();
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleAsync<WorkLogEntry>(sql, entry);
    }

    public async Task<IReadOnlyList<WorkLogEntry>> ListByDateAsync(string logDate)
    {
        var sql = $"""
            SELECT {Columns}
            FROM WorkLogEntry
            WHERE date(CreatedAt) = @LogDate AND DeletedAt IS NULL
            ORDER BY CreatedAt DESC, Id DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<WorkLogEntry>(sql, new { LogDate = logDate });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<WorkLogEntry>> ListByTaskAsync(int taskId)
    {
        var sql = $"""
            SELECT {Columns}
            FROM WorkLogEntry
            WHERE TaskId = @TaskId AND DeletedAt IS NULL
            ORDER BY CreatedAt DESC, Id DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<WorkLogEntry>(sql, new { TaskId = taskId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<WorkLogEntry>> ListByProblemAsync(int problemId)
    {
        var sql = $"""
            SELECT {Columns}
            FROM WorkLogEntry
            WHERE ProblemId = @ProblemId AND DeletedAt IS NULL
            ORDER BY CreatedAt DESC, Id DESC
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
            FROM WorkLogEntry
            WHERE TaskId = @TaskId AND DeletedAt IS NULL AND CreatedAt >= @Since
              AND (
                    @Automatic = 1 AND Source IN ('Timer', 'Extension')
                    OR @Automatic = 0 AND Source = @Source
                  )
            ORDER BY Id DESC
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
}

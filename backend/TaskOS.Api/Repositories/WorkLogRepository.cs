using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class WorkLogRepository : IWorkLogRepository
{
    private const string Columns = "Id, Description, DurationMinutes, Source, TaskId, ProblemId, CreatedAt";
    private readonly SqliteConnectionFactory _factory;

    public WorkLogRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<WorkLogEntry> CreateAsync(WorkLogEntry entry)
    {
        const string sql = """
            INSERT INTO WorkLogEntry (Description, DurationMinutes, Source, TaskId, ProblemId, CreatedAt)
            VALUES (@Description, @DurationMinutes, @Source, @TaskId, @ProblemId, @CreatedAt);
            SELECT Id, Description, DurationMinutes, Source, TaskId, ProblemId, CreatedAt
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
}

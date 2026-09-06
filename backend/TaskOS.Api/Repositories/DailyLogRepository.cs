using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class DailyLogRepository : IDailyLogRepository
{
    private readonly SqliteConnectionFactory _factory;

    public DailyLogRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<DailyLog?> GetByDateAsync(string logDate)
    {
        const string sql = "SELECT Id, LogDate, Note, CreatedAt FROM DailyLog WHERE LogDate = @LogDate AND DeletedAt IS NULL";
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<DailyLog>(sql, new { LogDate = logDate });
    }

    public async Task<IReadOnlyList<DailyLog>> ListAsync()
    {
        const string sql = "SELECT Id, LogDate, Note, CreatedAt FROM DailyLog WHERE DeletedAt IS NULL ORDER BY LogDate DESC";
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<DailyLog>(sql);
        return rows.ToList();
    }

    public async Task<DailyLog> UpsertAsync(string logDate, string note, string createdAt)
    {
        const string sql = """
            INSERT INTO DailyLog (LogDate, Note, CreatedAt)
            VALUES (@LogDate, @Note, @CreatedAt)
            ON CONFLICT(LogDate) DO UPDATE SET Note = excluded.Note;
            SELECT Id, LogDate, Note, CreatedAt FROM DailyLog WHERE LogDate = @LogDate AND DeletedAt IS NULL;
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleAsync<DailyLog>(sql, new
        {
            LogDate = logDate,
            Note = note,
            CreatedAt = createdAt
        });
    }
}

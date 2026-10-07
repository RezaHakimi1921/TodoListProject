using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;
using TaskOS.Api.Services;

namespace TaskOS.Api.Repositories;

public sealed class DailyLogRepository : IDailyLogRepository
{
    private readonly SqliteConnectionFactory _factory;
    private readonly ICurrentUser _user;

    public DailyLogRepository(SqliteConnectionFactory factory, ICurrentUser user)
    {
        _factory = factory;
        _user = user;
    }

    public async Task<DailyLog?> GetByDateAsync(string logDate)
    {
        const string sql = """
            SELECT Id, LogDate, Note, CreatedAt
            FROM DailyLog
            WHERE LogDate = @LogDate AND OwnerUserId = @OwnerUserId AND DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<DailyLog>(sql, new
        {
            LogDate = logDate,
            OwnerUserId = _user.RequireUserId(),
        });
    }

    public async Task<IReadOnlyList<DailyLog>> ListAsync()
    {
        const string sql = """
            SELECT Id, LogDate, Note, CreatedAt
            FROM DailyLog
            WHERE OwnerUserId = @OwnerUserId AND DeletedAt IS NULL
            ORDER BY LogDate DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<DailyLog>(sql, new { OwnerUserId = _user.RequireUserId() });
        return rows.ToList();
    }

    public async Task<DailyLog> UpsertAsync(string logDate, string note, string createdAt)
    {
        const string sql = """
            INSERT INTO DailyLog (LogDate, OwnerUserId, Note, CreatedAt)
            VALUES (@LogDate, @OwnerUserId, @Note, @CreatedAt)
            ON CONFLICT(LogDate, OwnerUserId) DO UPDATE SET
                Note = excluded.Note,
                DeletedAt = NULL;
            SELECT Id, LogDate, Note, CreatedAt
            FROM DailyLog
            WHERE LogDate = @LogDate AND OwnerUserId = @OwnerUserId AND DeletedAt IS NULL;
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleAsync<DailyLog>(sql, new
        {
            LogDate = logDate,
            OwnerUserId = _user.RequireUserId(),
            Note = note,
            CreatedAt = createdAt
        });
    }
}

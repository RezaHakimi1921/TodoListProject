using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public sealed class TrashService : ITrashService
{
    private readonly SqliteConnectionFactory _factory;

    public TrashService(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<TrashItemDto>> ListAsync()
    {
        const string sql = """
            SELECT 'task' AS Kind, Id, Title, DeletedAt FROM Task WHERE DeletedAt IS NOT NULL
            UNION ALL
            SELECT 'timeline', Id, Note, DeletedAt FROM TaskTimelineEntry WHERE DeletedAt IS NOT NULL
            UNION ALL
            SELECT 'dailylog', Id, Note, DeletedAt FROM DailyLog WHERE DeletedAt IS NOT NULL
            UNION ALL
            SELECT 'worklog', Id, Description, DeletedAt FROM WorkLogEntry WHERE DeletedAt IS NOT NULL
            UNION ALL
            SELECT 'problem', Id, Title, DeletedAt FROM Problem WHERE DeletedAt IS NOT NULL
            UNION ALL
            SELECT 'option', Id, Title, DeletedAt FROM ProblemOption WHERE DeletedAt IS NOT NULL
            ORDER BY DeletedAt DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TrashItemDto>(sql);
        return rows.ToList();
    }

    public async Task SoftDeleteAsync(string kind, int id)
    {
        var now = TaskMapping.Now();
        using var connection = _factory.Create();
        var updated = kind.ToLowerInvariant() switch
        {
            TrashKinds.Task => await connection.ExecuteAsync(
                "UPDATE Task SET DeletedAt = @Now, UpdatedAt = @Now WHERE Id = @Id AND DeletedAt IS NULL",
                new { Id = id, Now = now }),
            TrashKinds.Timeline => await connection.ExecuteAsync(
                "UPDATE TaskTimelineEntry SET DeletedAt = @Now WHERE Id = @Id AND DeletedAt IS NULL",
                new { Id = id, Now = now }),
            TrashKinds.WorkLog => await connection.ExecuteAsync(
                "UPDATE WorkLogEntry SET DeletedAt = @Now WHERE Id = @Id AND DeletedAt IS NULL",
                new { Id = id, Now = now }),
            TrashKinds.Problem => await connection.ExecuteAsync(
                "UPDATE Problem SET DeletedAt = @Now, UpdatedAt = @Now WHERE Id = @Id AND DeletedAt IS NULL",
                new { Id = id, Now = now }),
            TrashKinds.Option => await SoftDeleteOptionAsync(connection, id, now),
            TrashKinds.DailyLog => await SoftDeleteDailyLogAsync(connection, id, now),
            _ => throw new ArgumentException("Unknown trash kind.")
        };

        if (updated == 0)
        {
            throw new KeyNotFoundException("Item not found or already in trash.");
        }
    }

    public async Task RestoreAsync(string kind, int id)
    {
        using var connection = _factory.Create();
        var updated = kind.ToLowerInvariant() switch
        {
            TrashKinds.Task => await connection.ExecuteAsync(
                "UPDATE Task SET DeletedAt = NULL, UpdatedAt = @Now WHERE Id = @Id AND DeletedAt IS NOT NULL",
                new { Id = id, Now = TaskMapping.Now() }),
            TrashKinds.Timeline => await connection.ExecuteAsync(
                "UPDATE TaskTimelineEntry SET DeletedAt = NULL WHERE Id = @Id AND DeletedAt IS NOT NULL",
                new { Id = id }),
            TrashKinds.WorkLog => await connection.ExecuteAsync(
                "UPDATE WorkLogEntry SET DeletedAt = NULL WHERE Id = @Id AND DeletedAt IS NOT NULL",
                new { Id = id }),
            TrashKinds.Problem => await connection.ExecuteAsync(
                "UPDATE Problem SET DeletedAt = NULL, UpdatedAt = @Now WHERE Id = @Id AND DeletedAt IS NOT NULL",
                new { Id = id, Now = TaskMapping.Now() }),
            TrashKinds.Option => await connection.ExecuteAsync(
                "UPDATE ProblemOption SET DeletedAt = NULL WHERE Id = @Id AND DeletedAt IS NOT NULL",
                new { Id = id }),
            TrashKinds.DailyLog => await RestoreDailyLogAsync(connection, id),
            _ => throw new ArgumentException("Unknown trash kind.")
        };

        if (updated == 0)
        {
            throw new KeyNotFoundException("Item is not in trash.");
        }
    }

    public async Task PurgeAsync(string kind, int id)
    {
        using var connection = _factory.Create();
        var sql = kind.ToLowerInvariant() switch
        {
            TrashKinds.Task => "DELETE FROM Task WHERE Id = @Id AND DeletedAt IS NOT NULL",
            TrashKinds.Timeline => "DELETE FROM TaskTimelineEntry WHERE Id = @Id AND DeletedAt IS NOT NULL",
            TrashKinds.DailyLog => "DELETE FROM DailyLog WHERE Id = @Id AND DeletedAt IS NOT NULL",
            TrashKinds.WorkLog => "DELETE FROM WorkLogEntry WHERE Id = @Id AND DeletedAt IS NOT NULL",
            TrashKinds.Problem => "DELETE FROM Problem WHERE Id = @Id AND DeletedAt IS NOT NULL",
            TrashKinds.Option => "DELETE FROM ProblemOption WHERE Id = @Id AND DeletedAt IS NOT NULL",
            _ => throw new ArgumentException("Unknown trash kind.")
        };
        var updated = await connection.ExecuteAsync(sql, new { Id = id });
        if (updated == 0)
        {
            throw new KeyNotFoundException("Item is not in trash.");
        }
    }

    public async Task EmptyAsync()
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync("""
            DELETE FROM TaskTimelineEntry WHERE DeletedAt IS NOT NULL;
            DELETE FROM ProblemOption WHERE DeletedAt IS NOT NULL;
            DELETE FROM Task WHERE DeletedAt IS NOT NULL;
            DELETE FROM DailyLog WHERE DeletedAt IS NOT NULL;
            DELETE FROM WorkLogEntry WHERE DeletedAt IS NOT NULL;
            DELETE FROM Problem WHERE DeletedAt IS NOT NULL;
            """);
    }

    private static async Task<int> SoftDeleteDailyLogAsync(Microsoft.Data.Sqlite.SqliteConnection connection, int id, string now)
    {
        return await connection.ExecuteAsync("""
            UPDATE DailyLog
            SET DeletedAt = @Now,
                LogDate = CASE
                    WHEN LogDate LIKE '__trash_%' THEN LogDate
                    ELSE '__trash_' || Id || '__' || LogDate
                END
            WHERE Id = @Id AND DeletedAt IS NULL
            """, new { Id = id, Now = now });
    }

    private static async Task<int> RestoreDailyLogAsync(Microsoft.Data.Sqlite.SqliteConnection connection, int id)
    {
        var current = await connection.QuerySingleOrDefaultAsync<string>(
            "SELECT LogDate FROM DailyLog WHERE Id = @Id AND DeletedAt IS NOT NULL", new { Id = id });
        if (current is null) return 0;

        var original = UnwrapDailyLogDate(current, id);
        var clash = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM DailyLog WHERE LogDate = @LogDate AND DeletedAt IS NULL AND Id <> @Id",
            new { LogDate = original, Id = id });
        if (clash > 0)
        {
            throw new InvalidOperationException("یک گزارش فعال برای این تاریخ وجود دارد. اول آن را پاک کن، بعد این را برگردان.");
        }

        return await connection.ExecuteAsync(
            "UPDATE DailyLog SET DeletedAt = NULL, LogDate = @LogDate WHERE Id = @Id",
            new { Id = id, LogDate = original });
    }

    private static async Task<int> SoftDeleteOptionAsync(Microsoft.Data.Sqlite.SqliteConnection connection, int id, string now)
    {
        var problemId = await connection.QuerySingleOrDefaultAsync<int?>(
            "SELECT ProblemId FROM ProblemOption WHERE Id = @Id AND DeletedAt IS NULL", new { Id = id });
        if (problemId is null) return 0;

        await connection.ExecuteAsync("""
            UPDATE Problem
            SET ChosenOptionId = NULL,
                PremortemSign = NULL,
                Status = CASE WHEN ChosenOptionId = @Id THEN 'Exploring' ELSE Status END,
                UpdatedAt = @Now
            WHERE Id = @ProblemId AND ChosenOptionId = @Id
            """, new { Id = id, ProblemId = problemId, Now = now });

        return await connection.ExecuteAsync(
            "UPDATE ProblemOption SET DeletedAt = @Now WHERE Id = @Id AND DeletedAt IS NULL",
            new { Id = id, Now = now });
    }

    private static string UnwrapDailyLogDate(string stored, int id)
    {
        var prefix = $"__trash_{id}__";
        return stored.StartsWith(prefix, StringComparison.Ordinal) ? stored[prefix.Length..] : stored;
    }
}

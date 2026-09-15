using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class JiraCommentInboxRepository : IJiraCommentInboxRepository
{
    private const string Columns = """
        i.Id, i.TaskId, i.JiraKey, i.CommentId, i.AuthorName, i.Body, i.CreatedAt, i.SeenAt, i.ReceivedAt,
        COALESCE(t.Title, i.JiraKey) AS TaskTitle,
        COALESCE(t.Status, '') AS TaskStatus,
        j.JiraUrl AS JiraUrl
        """;

    private readonly SqliteConnectionFactory _factory;

    public JiraCommentInboxRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<JiraCommentInboxEntry>> ListAsync(bool unreadOnly)
    {
        var sql = $"""
            SELECT {Columns}
            FROM JiraCommentInbox i
            LEFT JOIN Task t ON t.Id = i.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = i.TaskId
            WHERE (@UnreadOnly = 0 OR i.SeenAt IS NULL)
            ORDER BY i.CreatedAt DESC, i.Id DESC
            LIMIT 200
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<JiraCommentInboxEntry>(sql, new { UnreadOnly = unreadOnly ? 1 : 0 });
        return rows.ToList();
    }

    public async Task<int> CountUnreadAsync()
    {
        using var connection = _factory.Create();
        return await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM JiraCommentInbox WHERE SeenAt IS NULL");
    }

    public async Task<(int NewTasks, int Comments, int Khadang, int Reminders)> CountUnreadByKindAsync()
    {
        using var connection = _factory.Create();
        var newTasks = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM JiraCommentInbox WHERE SeenAt IS NULL AND CommentId LIKE 'new-task:%'");
        var reminders = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM JiraCommentInbox WHERE SeenAt IS NULL AND CommentId LIKE 'reminder:%'");
        // Khadang AI agent comments — match author name/display containing khadang / خدنگ
        const string khadangFilter = """
            CommentId NOT LIKE 'new-task:%'
            AND CommentId NOT LIKE 'reminder:%'
            AND (
                lower(ifnull(AuthorName, '')) LIKE '%khadang%'
                OR ifnull(AuthorName, '') LIKE '%خدنگ%'
            )
            """;
        var khadang = await connection.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM JiraCommentInbox WHERE SeenAt IS NULL AND {khadangFilter}");
        var comments = await connection.ExecuteScalarAsync<int>(
            """
            SELECT COUNT(*) FROM JiraCommentInbox
            WHERE SeenAt IS NULL
              AND CommentId NOT LIKE 'new-task:%'
              AND CommentId NOT LIKE 'reminder:%'
              AND NOT (
                lower(ifnull(AuthorName, '')) LIKE '%khadang%'
                OR ifnull(AuthorName, '') LIKE '%خدنگ%'
              )
            """);
        return (newTasks, comments, khadang, reminders);
    }

    public async Task<IReadOnlyDictionary<int, int>> UnreadReminderCountsByTaskIdsAsync(IReadOnlyList<int> taskIds)
    {
        if (taskIds.Count == 0) return new Dictionary<int, int>();
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<(int TaskId, int Count)>(
            """
            SELECT TaskId, COUNT(*) AS Count
            FROM JiraCommentInbox
            WHERE SeenAt IS NULL
              AND CommentId LIKE 'reminder:%'
              AND TaskId IN @TaskIds
            GROUP BY TaskId
            """,
            new { TaskIds = taskIds.ToArray() });
        return rows.ToDictionary(r => r.TaskId, r => r.Count);
    }

    public async Task<bool> InsertIfNewAsync(JiraCommentInboxEntry entry)
    {
        const string sql = """
            INSERT OR IGNORE INTO JiraCommentInbox
                (TaskId, JiraKey, CommentId, AuthorName, Body, CreatedAt, SeenAt, ReceivedAt)
            VALUES
                (@TaskId, @JiraKey, @CommentId, @AuthorName, @Body, @CreatedAt, @SeenAt, @ReceivedAt);
            SELECT changes();
            """;
        using var connection = _factory.Create();
        var changes = await connection.ExecuteScalarAsync<int>(sql, entry);
        return changes > 0;
    }

    public async Task SeedRecentNewTasksAsync(string sinceIso, string startOfTodayIso, string receivedAt)
    {
        const string sql = """
            INSERT OR IGNORE INTO JiraCommentInbox
                (TaskId, JiraKey, CommentId, AuthorName, Body, CreatedAt, SeenAt, ReceivedAt)
            SELECT
                t.Id,
                j.JiraKey,
                'new-task:' || j.JiraKey,
                'جیرا',
                'تسک جدید ثبت شد',
                t.CreatedAt,
                NULL,
                @ReceivedAt
            FROM Task t
            JOIN TaskJira j ON j.TaskId = t.Id
            WHERE t.DeletedAt IS NULL
              AND t.Status != 'Done'
              AND j.JiraKey LIKE 'PS-%'
              AND j.OpenCount <= 1
              AND t.CreatedAt >= @Since
              AND (
                t.CreatedAt >= @StartOfToday
                OR NOT EXISTS (
                    SELECT 1 FROM WorkLogEntry w
                    WHERE w.TaskId = t.Id AND w.DeletedAt IS NULL
                )
              )
            """;
        using var connection = _factory.Create();
        await connection.ExecuteAsync(sql, new
        {
            Since = sinceIso,
            StartOfToday = startOfTodayIso,
            ReceivedAt = receivedAt
        });
    }

    public async Task MarkReadAsync(int id, string seenAt)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE JiraCommentInbox SET SeenAt = @SeenAt WHERE Id = @Id AND SeenAt IS NULL",
            new { Id = id, SeenAt = seenAt });
    }

    public async Task MarkReadByTaskAsync(int taskId, string seenAt)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE JiraCommentInbox SET SeenAt = @SeenAt WHERE TaskId = @TaskId AND SeenAt IS NULL",
            new { TaskId = taskId, SeenAt = seenAt });
    }

    public async Task MarkReadRemindersByTaskAsync(int taskId, string seenAt)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            """
            UPDATE JiraCommentInbox
            SET SeenAt = @SeenAt
            WHERE TaskId = @TaskId
              AND SeenAt IS NULL
              AND CommentId LIKE 'reminder:%'
            """,
            new { TaskId = taskId, SeenAt = seenAt });
    }

    public async Task MarkAllRemindersReadAsync(string seenAt)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            """
            UPDATE JiraCommentInbox
            SET SeenAt = @SeenAt
            WHERE SeenAt IS NULL
              AND CommentId LIKE 'reminder:%'
            """,
            new { SeenAt = seenAt });
    }

    public async Task MarkReadByJiraKeyAsync(string jiraKey, string seenAt)
    {
        var key = (jiraKey ?? string.Empty).Trim().ToUpperInvariant();
        if (key.Length == 0) return;
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            """
            UPDATE JiraCommentInbox
            SET SeenAt = @SeenAt
            WHERE SeenAt IS NULL
              AND (upper(JiraKey) = @JiraKey OR CommentId = 'new-task:' || @JiraKey)
            """,
            new { JiraKey = key, SeenAt = seenAt });
    }
}

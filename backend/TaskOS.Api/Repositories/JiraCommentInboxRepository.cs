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
}

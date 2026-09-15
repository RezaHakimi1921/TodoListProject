using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class TaskReminderRepository : ITaskReminderRepository
{
    private readonly SqliteConnectionFactory _factory;

    public TaskReminderRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<TaskReminder>> ListByTaskAsync(int taskId)
    {
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskReminder>(
            """
            SELECT Id, TaskId, RemindAt, Note, CreatedAt, FiredAt
            FROM TaskReminder
            WHERE TaskId = @TaskId
            ORDER BY RemindAt ASC
            """,
            new { TaskId = taskId });
        return rows.ToList();
    }

    public async Task<IReadOnlyDictionary<int, string>> NextRemindAtByTaskIdsAsync(IReadOnlyList<int> taskIds)
    {
        if (taskIds.Count == 0) return new Dictionary<int, string>();
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<(int TaskId, string RemindAt)>(
            """
            SELECT TaskId, MIN(RemindAt) AS RemindAt
            FROM TaskReminder
            WHERE FiredAt IS NULL
              AND TaskId IN @TaskIds
              AND RemindAt >= @Now
            GROUP BY TaskId
            """,
            new { TaskIds = taskIds.ToArray(), Now = DateTime.UtcNow.ToString("o") });
        return rows.ToDictionary(r => r.TaskId, r => r.RemindAt);
    }

    public async Task<IReadOnlyDictionary<int, int>> PendingCountByTaskIdsAsync(IReadOnlyList<int> taskIds)
    {
        if (taskIds.Count == 0) return new Dictionary<int, int>();
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<(int TaskId, int Count)>(
            """
            SELECT TaskId, COUNT(*) AS Count
            FROM TaskReminder
            WHERE FiredAt IS NULL
              AND TaskId IN @TaskIds
            GROUP BY TaskId
            """,
            new { TaskIds = taskIds.ToArray() });
        return rows.ToDictionary(r => r.TaskId, r => r.Count);
    }

    public async Task<TaskReminder?> GetAsync(int id)
    {
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<TaskReminder>(
            "SELECT Id, TaskId, RemindAt, Note, CreatedAt, FiredAt FROM TaskReminder WHERE Id = @Id",
            new { Id = id });
    }

    public async Task<TaskReminder> CreateAsync(TaskReminder reminder)
    {
        using var connection = _factory.Create();
        var id = await connection.ExecuteScalarAsync<long>(
            """
            INSERT INTO TaskReminder (TaskId, RemindAt, Note, CreatedAt, FiredAt)
            VALUES (@TaskId, @RemindAt, @Note, @CreatedAt, NULL);
            SELECT last_insert_rowid();
            """,
            reminder);
        reminder.Id = (int)id;
        return reminder;
    }

    public async Task DeleteAsync(int id)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync("DELETE FROM TaskReminder WHERE Id = @Id", new { Id = id });
    }

    public async Task<IReadOnlyList<TaskReminder>> ListDueAsync(string nowIso)
    {
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskReminder>(
            """
            SELECT r.Id, r.TaskId, r.RemindAt, r.Note, r.CreatedAt, r.FiredAt,
                   t.Title AS TaskTitle,
                   j.JiraKey AS JiraKey
            FROM TaskReminder r
            INNER JOIN Task t ON t.Id = r.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = r.TaskId
            WHERE r.FiredAt IS NULL
              AND r.RemindAt <= @Now
            ORDER BY r.RemindAt ASC
            LIMIT 50
            """,
            new { Now = nowIso });
        return rows.ToList();
    }

    public async Task MarkFiredAsync(int id, string firedAt)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE TaskReminder SET FiredAt = @FiredAt WHERE Id = @Id AND FiredAt IS NULL",
            new { Id = id, FiredAt = firedAt });
    }

    public async Task<bool> UpdateAsync(int id, string remindAt, string? note)
    {
        using var connection = _factory.Create();
        var n = await connection.ExecuteAsync(
            """
            UPDATE TaskReminder
            SET RemindAt = @RemindAt, Note = @Note
            WHERE Id = @Id AND FiredAt IS NULL
            """,
            new { Id = id, RemindAt = remindAt, Note = note });
        return n > 0;
    }

    public async Task<IReadOnlyList<TaskReminder>> ListPendingAsync()
    {
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskReminder>(
            """
            SELECT r.Id, r.TaskId, r.RemindAt, r.Note, r.CreatedAt, r.FiredAt,
                   t.Title AS TaskTitle,
                   j.JiraKey AS JiraKey
            FROM TaskReminder r
            INNER JOIN Task t ON t.Id = r.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = r.TaskId
            WHERE r.FiredAt IS NULL
            ORDER BY r.RemindAt ASC
            """);
        return rows.ToList();
    }

    public async Task<IReadOnlyList<TaskReminder>> ListFiredAsync(int limit = 50)
    {
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskReminder>(
            """
            SELECT r.Id, r.TaskId, r.RemindAt, r.Note, r.CreatedAt, r.FiredAt,
                   t.Title AS TaskTitle,
                   j.JiraKey AS JiraKey
            FROM TaskReminder r
            INNER JOIN Task t ON t.Id = r.TaskId AND t.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = r.TaskId
            WHERE r.FiredAt IS NOT NULL
            ORDER BY r.FiredAt DESC
            LIMIT @Limit
            """,
            new { Limit = Math.Clamp(limit, 1, 200) });
        return rows.ToList();
    }

}

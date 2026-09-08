using Dapper;
using TaskOS.Api.Data;

namespace TaskOS.Api.Repositories;

public sealed class TaskJiraRepository : ITaskJiraRepository
{
    private readonly SqliteConnectionFactory _factory;

    public TaskJiraRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<TaskJiraRow?> GetByKeyAsync(string jiraKey)
    {
        const string sql = """
            SELECT j.TaskId, j.JiraKey, j.JiraUrl, j.Description, j.OpenCount, j.LastSeenAt, t.Title, t.Status
            FROM TaskJira j
            JOIN Task t ON t.Id = j.TaskId
            WHERE j.JiraKey = @JiraKey AND t.DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<TaskJiraRow>(sql, new { JiraKey = jiraKey });
    }

    public async Task<TaskJiraRow?> GetByTaskIdAsync(int taskId)
    {
        const string sql = """
            SELECT j.TaskId, j.JiraKey, j.JiraUrl, j.Description, j.OpenCount, j.LastSeenAt, t.Title, t.Status
            FROM TaskJira j
            JOIN Task t ON t.Id = j.TaskId
            WHERE j.TaskId = @TaskId AND t.DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<TaskJiraRow>(sql, new { TaskId = taskId });
    }

    public async Task<IReadOnlyList<TaskJiraRow>> ListByTaskIdsAsync(IReadOnlyCollection<int> taskIds)
    {
        if (taskIds.Count == 0)
        {
            return [];
        }

        const string sql = """
            SELECT j.TaskId, j.JiraKey, j.JiraUrl, j.Description, j.OpenCount, j.LastSeenAt, t.Title, t.Status
            FROM TaskJira j
            JOIN Task t ON t.Id = j.TaskId
            WHERE t.DeletedAt IS NULL AND j.TaskId IN @Ids
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskJiraRow>(sql, new { Ids = taskIds });
        return rows.ToList();
    }

    public async Task UpsertAsync(int taskId, string jiraKey, string? jiraUrl, int openCount, string lastSeenAt)
    {
        const string sql = """
            INSERT INTO TaskJira (TaskId, JiraKey, JiraUrl, OpenCount, LastSeenAt)
            VALUES (@TaskId, @JiraKey, @JiraUrl, @OpenCount, @LastSeenAt)
            ON CONFLICT(TaskId) DO UPDATE SET
                JiraKey = excluded.JiraKey,
                JiraUrl = excluded.JiraUrl,
                OpenCount = excluded.OpenCount,
                LastSeenAt = excluded.LastSeenAt;
            """;
        using var connection = _factory.Create();
        await connection.ExecuteAsync(sql, new
        {
            TaskId = taskId,
            JiraKey = jiraKey,
            JiraUrl = jiraUrl,
            OpenCount = openCount,
            LastSeenAt = lastSeenAt
        });
    }
}

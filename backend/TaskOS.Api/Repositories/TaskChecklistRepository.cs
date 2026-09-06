using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class TaskChecklistRepository : ITaskChecklistRepository
{
    private readonly SqliteConnectionFactory _factory;

    public TaskChecklistRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<TaskChecklistItem>> ListByTaskAsync(int taskId)
    {
        const string sql = """
            SELECT Id, TaskId, Title, IsDone, SortOrder, CreatedAt, DoneAt
            FROM TaskChecklistItem
            WHERE TaskId = @TaskId
            ORDER BY SortOrder ASC, Id ASC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskChecklistItem>(sql, new { TaskId = taskId });
        return rows.ToList();
    }

    public async Task<TaskChecklistItem?> GetAsync(int taskId, int itemId)
    {
        const string sql = """
            SELECT Id, TaskId, Title, IsDone, SortOrder, CreatedAt, DoneAt
            FROM TaskChecklistItem
            WHERE TaskId = @TaskId AND Id = @Id
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<TaskChecklistItem>(sql, new { TaskId = taskId, Id = itemId });
    }

    public async Task<int> NextSortOrderAsync(int taskId)
    {
        using var connection = _factory.Create();
        var max = await connection.ExecuteScalarAsync<int?>(
            "SELECT MAX(SortOrder) FROM TaskChecklistItem WHERE TaskId = @TaskId",
            new { TaskId = taskId });
        return (max ?? -1) + 1;
    }

    public async Task<TaskChecklistItem> CreateAsync(TaskChecklistItem item)
    {
        const string sql = """
            INSERT INTO TaskChecklistItem (TaskId, Title, IsDone, SortOrder, CreatedAt, DoneAt)
            VALUES (@TaskId, @Title, @IsDone, @SortOrder, @CreatedAt, @DoneAt);
            SELECT Id, TaskId, Title, IsDone, SortOrder, CreatedAt, DoneAt
            FROM TaskChecklistItem
            WHERE Id = last_insert_rowid();
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleAsync<TaskChecklistItem>(sql, item);
    }

    public async Task<bool> UpdateAsync(TaskChecklistItem item)
    {
        const string sql = """
            UPDATE TaskChecklistItem
            SET Title = @Title, IsDone = @IsDone, SortOrder = @SortOrder, DoneAt = @DoneAt
            WHERE Id = @Id AND TaskId = @TaskId
            """;
        using var connection = _factory.Create();
        return await connection.ExecuteAsync(sql, item) > 0;
    }

    public async Task<bool> DeleteAsync(int taskId, int itemId)
    {
        using var connection = _factory.Create();
        return await connection.ExecuteAsync(
            "DELETE FROM TaskChecklistItem WHERE Id = @Id AND TaskId = @TaskId",
            new { Id = itemId, TaskId = taskId }) > 0;
    }

    public async Task<IReadOnlyDictionary<int, ChecklistCount>> CountsByTaskIdsAsync(IReadOnlyCollection<int> taskIds)
    {
        if (taskIds.Count == 0)
        {
            return new Dictionary<int, ChecklistCount>();
        }

        const string sql = """
            SELECT TaskId, COUNT(*) AS Total, SUM(CASE WHEN IsDone = 1 THEN 1 ELSE 0 END) AS Done
            FROM TaskChecklistItem
            WHERE TaskId IN @TaskIds
            GROUP BY TaskId
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<ChecklistCount>(sql, new { TaskIds = taskIds });
        return rows.ToDictionary(row => row.TaskId);
    }
}

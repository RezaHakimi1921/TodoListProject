using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class ProblemRepository : IProblemRepository
{
    private const string ProblemColumns = """
        Id, Title, Status, NoTimeNote, InfiniteTimeNote, ChosenOptionId, PremortemSign,
        ExpectedBehavior, ActualBehavior, RootCause, DetectionGap, AffectedPopulation,
        Resolution, Recovery, ValidationNote, Prevention,
        ImpactBranches, ImpactCustomers, ImpactRecords, ImpactServices, ImpactSupport, ImpactBusiness,
        StartedAt, FirstAffectedAt, DetectedAt, RootCauseFoundAt, FixedAt, RecoveryCompletedAt,
        CostTechnical, CostOperational, CostBusiness, CostOpportunity, SectionSavedAt,
        CreatedAt, UpdatedAt
        """;

    private readonly SqliteConnectionFactory _factory;

    public ProblemRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<ProblemRecord>> ListAsync()
    {
        var sql = $"""
            SELECT {ProblemColumns}
            FROM Problem
            WHERE DeletedAt IS NULL
            ORDER BY CASE Status WHEN 'Open' THEN 0 WHEN 'Monitoring' THEN 1 ELSE 2 END, UpdatedAt DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<ProblemRecord>(sql);
        return rows.ToList();
    }

    public async Task<ProblemRecord?> GetAsync(int id)
    {
        var sql = $"""
            SELECT {ProblemColumns}
            FROM Problem WHERE Id = @Id AND DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<ProblemRecord>(sql, new { Id = id });
    }

    public async Task<int> CreateAsync(ProblemRecord problem)
    {
        const string sql = """
            INSERT INTO Problem (Title, Status, CreatedAt, UpdatedAt)
            VALUES (@Title, @Status, @CreatedAt, @UpdatedAt);
            SELECT last_insert_rowid();
            """;
        using var connection = _factory.Create();
        return await connection.ExecuteScalarAsync<int>(sql, problem);
    }

    public async Task UpdateAsync(ProblemRecord problem)
    {
        const string sql = """
            UPDATE Problem
            SET Title = @Title,
                Status = @Status,
                NoTimeNote = @NoTimeNote,
                InfiniteTimeNote = @InfiniteTimeNote,
                ChosenOptionId = @ChosenOptionId,
                PremortemSign = @PremortemSign,
                ExpectedBehavior = @ExpectedBehavior,
                ActualBehavior = @ActualBehavior,
                RootCause = @RootCause,
                DetectionGap = @DetectionGap,
                AffectedPopulation = @AffectedPopulation,
                Resolution = @Resolution,
                Recovery = @Recovery,
                ValidationNote = @ValidationNote,
                Prevention = @Prevention,
                ImpactBranches = @ImpactBranches,
                ImpactCustomers = @ImpactCustomers,
                ImpactRecords = @ImpactRecords,
                ImpactServices = @ImpactServices,
                ImpactSupport = @ImpactSupport,
                ImpactBusiness = @ImpactBusiness,
                StartedAt = @StartedAt,
                FirstAffectedAt = @FirstAffectedAt,
                DetectedAt = @DetectedAt,
                RootCauseFoundAt = @RootCauseFoundAt,
                FixedAt = @FixedAt,
                RecoveryCompletedAt = @RecoveryCompletedAt,
                CostTechnical = @CostTechnical,
                CostOperational = @CostOperational,
                CostBusiness = @CostBusiness,
                CostOpportunity = @CostOpportunity,
                SectionSavedAt = @SectionSavedAt,
                UpdatedAt = @UpdatedAt
            WHERE Id = @Id AND DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        await connection.ExecuteAsync(sql, problem);
    }

    public async Task<IReadOnlyList<ProblemOptionRecord>> ListOptionsAsync(int problemId)
    {
        const string sql = """
            SELECT Id, ProblemId, Title, JuniorExplain, SortOrder, CreatedAt
            FROM ProblemOption
            WHERE ProblemId = @ProblemId AND DeletedAt IS NULL
            ORDER BY SortOrder ASC, Id ASC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<ProblemOptionRecord>(sql, new { ProblemId = problemId });
        return rows.ToList();
    }

    public async Task<ProblemOptionRecord?> GetOptionAsync(int problemId, int optionId)
    {
        const string sql = """
            SELECT Id, ProblemId, Title, JuniorExplain, SortOrder, CreatedAt
            FROM ProblemOption
            WHERE ProblemId = @ProblemId AND Id = @Id AND DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<ProblemOptionRecord>(sql, new { ProblemId = problemId, Id = optionId });
    }

    public async Task<int> AddOptionAsync(ProblemOptionRecord option)
    {
        const string sql = """
            INSERT INTO ProblemOption (ProblemId, Title, JuniorExplain, SortOrder, CreatedAt)
            VALUES (@ProblemId, @Title, @JuniorExplain, @SortOrder, @CreatedAt);
            SELECT last_insert_rowid();
            """;
        using var connection = _factory.Create();
        return await connection.ExecuteScalarAsync<int>(sql, option);
    }

    public async Task UpdateOptionAsync(ProblemOptionRecord option)
    {
        const string sql = """
            UPDATE ProblemOption
            SET Title = @Title, JuniorExplain = @JuniorExplain, SortOrder = @SortOrder
            WHERE Id = @Id AND ProblemId = @ProblemId AND DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        await connection.ExecuteAsync(sql, option);
    }

    public async Task DeleteOptionAsync(int problemId, int optionId)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "UPDATE ProblemOption SET DeletedAt = @Now WHERE ProblemId = @ProblemId AND Id = @Id AND DeletedAt IS NULL",
            new { ProblemId = problemId, Id = optionId, Now = TaskOS.Api.Services.TaskMapping.Now() });
    }

    public async Task<IReadOnlyList<ProblemActionRecord>> ListActionsAsync(int problemId)
    {
        const string sql = """
            SELECT Id, ProblemId, Title, Owner, Deadline, Status, CreatedAt, UpdatedAt
            FROM ProblemAction
            WHERE ProblemId = @ProblemId
            ORDER BY CASE Status WHEN 'Open' THEN 0 ELSE 1 END, Id ASC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<ProblemActionRecord>(sql, new { ProblemId = problemId });
        return rows.ToList();
    }

    public async Task<ProblemActionRecord?> GetActionAsync(int problemId, int actionId)
    {
        const string sql = """
            SELECT Id, ProblemId, Title, Owner, Deadline, Status, CreatedAt, UpdatedAt
            FROM ProblemAction
            WHERE ProblemId = @ProblemId AND Id = @Id
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<ProblemActionRecord>(sql, new { ProblemId = problemId, Id = actionId });
    }

    public async Task<int> AddActionAsync(ProblemActionRecord action)
    {
        const string sql = """
            INSERT INTO ProblemAction (ProblemId, Title, Owner, Deadline, Status, CreatedAt, UpdatedAt)
            VALUES (@ProblemId, @Title, @Owner, @Deadline, @Status, @CreatedAt, @UpdatedAt);
            SELECT last_insert_rowid();
            """;
        using var connection = _factory.Create();
        return await connection.ExecuteScalarAsync<int>(sql, action);
    }

    public async Task UpdateActionAsync(ProblemActionRecord action)
    {
        const string sql = """
            UPDATE ProblemAction
            SET Title = @Title, Owner = @Owner, Deadline = @Deadline, Status = @Status, UpdatedAt = @UpdatedAt
            WHERE Id = @Id AND ProblemId = @ProblemId
            """;
        using var connection = _factory.Create();
        await connection.ExecuteAsync(sql, action);
    }

    public async Task DeleteActionAsync(int problemId, int actionId)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "DELETE FROM ProblemAction WHERE ProblemId = @ProblemId AND Id = @Id",
            new { ProblemId = problemId, Id = actionId });
    }

    public async Task AttachTaskAsync(int problemId, int taskId, string createdAt)
    {
        const string sql = """
            INSERT OR IGNORE INTO TaskProblem (TaskId, ProblemId, CreatedAt)
            VALUES (@TaskId, @ProblemId, @CreatedAt)
            """;
        using var connection = _factory.Create();
        await connection.ExecuteAsync(sql, new { TaskId = taskId, ProblemId = problemId, CreatedAt = createdAt });
    }

    public async Task DetachTaskAsync(int problemId, int taskId)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            "DELETE FROM TaskProblem WHERE TaskId = @TaskId AND ProblemId = @ProblemId",
            new { TaskId = taskId, ProblemId = problemId });
    }

    public async Task<IReadOnlyList<TaskProblemLinkRecord>> ListTasksAsync(int problemId)
    {
        const string sql = """
            SELECT
                t.Id AS TaskId,
                tp.ProblemId,
                p.Title AS ProblemTitle,
                p.Status AS ProblemStatus,
                t.Title AS TaskTitle,
                t.Status AS TaskStatus,
                j.JiraKey,
                j.JiraUrl
            FROM TaskProblem tp
            JOIN Task t ON t.Id = tp.TaskId AND t.DeletedAt IS NULL
            JOIN Problem p ON p.Id = tp.ProblemId AND p.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = t.Id
            WHERE tp.ProblemId = @ProblemId
            ORDER BY t.UpdatedAt DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskProblemLinkRecord>(sql, new { ProblemId = problemId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<TaskProblemLinkRecord>> ListProblemsForTaskAsync(int taskId)
    {
        const string sql = """
            SELECT
                t.Id AS TaskId,
                tp.ProblemId,
                p.Title AS ProblemTitle,
                p.Status AS ProblemStatus,
                t.Title AS TaskTitle,
                t.Status AS TaskStatus,
                j.JiraKey,
                j.JiraUrl
            FROM TaskProblem tp
            JOIN Task t ON t.Id = tp.TaskId AND t.DeletedAt IS NULL
            JOIN Problem p ON p.Id = tp.ProblemId AND p.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = t.Id
            WHERE tp.TaskId = @TaskId
            ORDER BY p.UpdatedAt DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskProblemLinkRecord>(sql, new { TaskId = taskId });
        return rows.ToList();
    }

    public async Task<IReadOnlyList<TaskProblemLinkRecord>> ListLinksByTaskIdsAsync(IReadOnlyList<int> taskIds)
    {
        if (taskIds.Count == 0) return [];
        const string sql = """
            SELECT
                t.Id AS TaskId,
                tp.ProblemId,
                p.Title AS ProblemTitle,
                p.Status AS ProblemStatus,
                t.Title AS TaskTitle,
                t.Status AS TaskStatus,
                j.JiraKey,
                j.JiraUrl
            FROM TaskProblem tp
            JOIN Task t ON t.Id = tp.TaskId AND t.DeletedAt IS NULL
            JOIN Problem p ON p.Id = tp.ProblemId AND p.DeletedAt IS NULL
            LEFT JOIN TaskJira j ON j.TaskId = t.Id
            WHERE tp.TaskId IN @TaskIds
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<TaskProblemLinkRecord>(sql, new { TaskIds = taskIds.ToArray() });
        return rows.ToList();
    }

    public async Task<int> CountTasksAsync(int problemId)
    {
        const string sql = """
            SELECT COUNT(*)
            FROM TaskProblem tp
            JOIN Task t ON t.Id = tp.TaskId AND t.DeletedAt IS NULL
            WHERE tp.ProblemId = @ProblemId
            """;
        using var connection = _factory.Create();
        return await connection.ExecuteScalarAsync<int>(sql, new { ProblemId = problemId });
    }
}

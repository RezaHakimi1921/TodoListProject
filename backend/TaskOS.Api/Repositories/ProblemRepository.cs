using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public sealed class ProblemRepository : IProblemRepository
{
    private readonly SqliteConnectionFactory _factory;

    public ProblemRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<ProblemRecord>> ListAsync()
    {
        const string sql = """
            SELECT Id, Title, Status, NoTimeNote, InfiniteTimeNote, ChosenOptionId, PremortemSign, CreatedAt, UpdatedAt
            FROM Problem
            WHERE DeletedAt IS NULL
            ORDER BY CASE Status WHEN 'Exploring' THEN 0 WHEN 'Chosen' THEN 1 ELSE 2 END, UpdatedAt DESC
            """;
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<ProblemRecord>(sql);
        return rows.ToList();
    }

    public async Task<ProblemRecord?> GetAsync(int id)
    {
        const string sql = """
            SELECT Id, Title, Status, NoTimeNote, InfiniteTimeNote, ChosenOptionId, PremortemSign, CreatedAt, UpdatedAt
            FROM Problem WHERE Id = @Id AND DeletedAt IS NULL
            """;
        using var connection = _factory.Create();
        return await connection.QuerySingleOrDefaultAsync<ProblemRecord>(sql, new { Id = id });
    }

    public async Task<int> CreateAsync(ProblemRecord problem)
    {
        const string sql = """
            INSERT INTO Problem (Title, Status, NoTimeNote, InfiniteTimeNote, ChosenOptionId, PremortemSign, CreatedAt, UpdatedAt)
            VALUES (@Title, @Status, @NoTimeNote, @InfiniteTimeNote, @ChosenOptionId, @PremortemSign, @CreatedAt, @UpdatedAt);
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
}

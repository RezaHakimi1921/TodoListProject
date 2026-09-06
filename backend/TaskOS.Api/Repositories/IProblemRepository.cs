using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface IProblemRepository
{
    Task<IReadOnlyList<ProblemRecord>> ListAsync();
    Task<ProblemRecord?> GetAsync(int id);
    Task<int> CreateAsync(ProblemRecord problem);
    Task UpdateAsync(ProblemRecord problem);
    Task<IReadOnlyList<ProblemOptionRecord>> ListOptionsAsync(int problemId);
    Task<ProblemOptionRecord?> GetOptionAsync(int problemId, int optionId);
    Task<int> AddOptionAsync(ProblemOptionRecord option);
    Task UpdateOptionAsync(ProblemOptionRecord option);
    Task DeleteOptionAsync(int problemId, int optionId);
}

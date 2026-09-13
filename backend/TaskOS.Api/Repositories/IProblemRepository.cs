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
    Task<IReadOnlyList<ProblemActionRecord>> ListActionsAsync(int problemId);
    Task<int> AddActionAsync(ProblemActionRecord action);
    Task UpdateActionAsync(ProblemActionRecord action);
    Task DeleteActionAsync(int problemId, int actionId);
    Task<ProblemActionRecord?> GetActionAsync(int problemId, int actionId);
    Task AttachTaskAsync(int problemId, int taskId, string createdAt);
    Task DetachTaskAsync(int problemId, int taskId);
    Task<IReadOnlyList<TaskProblemLinkRecord>> ListTasksAsync(int problemId);
    Task<IReadOnlyList<TaskProblemLinkRecord>> ListProblemsForTaskAsync(int taskId);
    Task<IReadOnlyList<TaskProblemLinkRecord>> ListLinksByTaskIdsAsync(IReadOnlyList<int> taskIds);
    Task<int> CountTasksAsync(int problemId);
}

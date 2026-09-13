using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IProblemService
{
    Task<IReadOnlyList<ProblemDto>> ListAsync();
    Task<ProblemDto?> GetAsync(int id);
    Task<ProblemDto> CreateAsync(CreateProblemRequest request);
    Task<ProblemDto?> UpdateAsync(int id, UpdateProblemRequest request);
    Task<ProblemDto?> AddOptionAsync(int id, UpsertOptionRequest request);
    Task<ProblemDto?> UpdateOptionAsync(int id, int optionId, UpsertOptionRequest request);
    Task<ProblemDto?> DeleteOptionAsync(int id, int optionId);
    Task<ProblemDto?> ChooseAsync(int id, ChooseOptionRequest request);
    Task<ProblemDto?> ValidateAsync(int id, ValidateProblemRequest request);
    Task<ProblemDto?> AddActionAsync(int id, UpsertProblemActionRequest request);
    Task<ProblemDto?> UpdateActionAsync(int id, int actionId, UpsertProblemActionRequest request);
    Task<ProblemDto?> DeleteActionAsync(int id, int actionId);
    Task<ProblemDto?> AttachTaskAsync(int id, int taskId);
    Task<ProblemDto?> AttachTasksAsync(int id, IReadOnlyList<int> taskIds);
    Task<ProblemDto?> DetachTaskAsync(int id, int taskId);
    Task<IReadOnlyList<ProblemLinkDto>> ListByTaskAsync(int taskId);
}

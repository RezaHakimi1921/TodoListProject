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
}

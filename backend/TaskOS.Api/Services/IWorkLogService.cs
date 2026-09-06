using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IWorkLogService
{
    Task<WorkLogDto> CaptureAsync(CaptureWorkLogRequest request);
    Task<IReadOnlyList<WorkLogDto>> ListByDateAsync(string logDate);
    Task<WorkLogSummaryDto> GetSummaryAsync(string logDate);
    Task<EntityWorkLogDto> ListByTaskAsync(int taskId);
    Task<EntityWorkLogDto> ListByProblemAsync(int problemId);
}

using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IDailyLogService
{
    Task<DailyLogDto?> GetByDateAsync(string logDate);
    Task<IReadOnlyList<DailyLogDto>> ListAsync();
    Task<DailyLogDto> UpsertAsync(UpsertDailyLogRequest request);
    Task<IReadOnlyList<TaskDto>> GetRelatedTasksAsync(string logDate);
}

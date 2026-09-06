using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface IDailyLogRepository
{
    Task<DailyLog?> GetByDateAsync(string logDate);
    Task<IReadOnlyList<DailyLog>> ListAsync();
    Task<DailyLog> UpsertAsync(string logDate, string note, string createdAt);
}

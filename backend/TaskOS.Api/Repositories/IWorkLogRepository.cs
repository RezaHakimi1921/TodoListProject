using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface IWorkLogRepository
{
    Task<WorkLogEntry> CreateAsync(WorkLogEntry entry);
    Task<IReadOnlyList<WorkLogEntry>> ListByDateAsync(string logDate);
    Task<IReadOnlyList<WorkLogEntry>> ListByTaskAsync(int taskId);
    Task<IReadOnlyList<WorkLogEntry>> ListByProblemAsync(int problemId);
}

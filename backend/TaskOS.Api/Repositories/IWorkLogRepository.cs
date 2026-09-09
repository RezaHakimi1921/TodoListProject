using TaskOS.Api.Models;

namespace TaskOS.Api.Repositories;

public interface IWorkLogRepository
{
    Task<WorkLogEntry> CreateAsync(WorkLogEntry entry);
    Task<IReadOnlyList<WorkLogEntry>> ListByDateAsync(string logDate);
    Task<IReadOnlyList<WorkLogEntry>> ListByTaskAsync(int taskId);
    Task<IReadOnlyList<WorkLogEntry>> ListByProblemAsync(int problemId);
    Task<WorkLogEntry?> FindRecentAsync(int taskId, string source, TimeSpan window);
    Task SetJiraWorklogIdAsync(int id, string jiraWorklogId);
    Task AddMinutesAsync(int id, int extra);
}

namespace TaskOS.Api.Repositories;

public sealed class TaskJiraRow
{
    public int TaskId { get; set; }
    public string JiraKey { get; set; } = string.Empty;
    public string? JiraUrl { get; set; }
    public string? Description { get; set; }
    public int OpenCount { get; set; }
    public string? LastSeenAt { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public interface ITaskJiraRepository
{
    Task<TaskJiraRow?> GetByKeyAsync(string jiraKey);
    Task<TaskJiraRow?> GetByTaskIdAsync(int taskId);
    Task<IReadOnlyList<TaskJiraRow>> ListByTaskIdsAsync(IReadOnlyCollection<int> taskIds);
    Task UpsertAsync(int taskId, string jiraKey, string? jiraUrl, int openCount, string lastSeenAt);
}

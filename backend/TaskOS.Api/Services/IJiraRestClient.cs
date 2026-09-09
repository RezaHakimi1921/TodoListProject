namespace TaskOS.Api.Services;

public sealed class JiraIssueRef
{
    public string Key { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
}

public sealed class JiraCommentItem
{
    public string Id { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public string Created { get; init; } = string.Empty;
    public string AuthorName { get; init; } = string.Empty;
    public string AuthorKey { get; init; } = string.Empty;
}

public sealed class JiraIssueComments
{
    public string Key { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
    public IReadOnlyList<JiraCommentItem> Comments { get; init; } = [];
}

public interface IJiraRestClient
{
    Task AddIssueCommentAsync(string jiraKey, string body, CancellationToken cancellationToken = default);
    Task<bool> AssignToMeAsync(string jiraKey, CancellationToken cancellationToken = default);
    Task<string?> GetSummaryAsync(string jiraKey, CancellationToken cancellationToken = default);
    Task<string?> AddWorklogAsync(string jiraKey, int minutes, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JiraIssueRef>> ListUnassignedProductSupportAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JiraIssueComments>> ListRecentlyUpdatedProductSupportAsync(CancellationToken cancellationToken = default);
}

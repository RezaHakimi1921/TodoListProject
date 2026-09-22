namespace TaskOS.Api.Services;

public sealed class JiraIssueRef
{
    public string Key { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
}

public sealed class JiraCreatedIssue
{
    public string Key { get; init; } = string.Empty;
    public string BrowseUrl { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
}

public sealed class JiraNamedOption
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}

public sealed class JiraUserOption
{
    public string Name { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
}

public sealed class JiraCreateMeta
{
    public string ProjectKey { get; init; } = "SIP";
    public IReadOnlyList<JiraNamedOption> IssueTypes { get; init; } = [];
    public IReadOnlyList<JiraNamedOption> Components { get; init; } = [];
    public IReadOnlyList<JiraUserOption> Assignees { get; init; } = [];
}

public sealed class JiraCommentItem
{
    public string Id { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public string Created { get; init; } = string.Empty;
    public string AuthorName { get; init; } = string.Empty;
    public string AuthorKey { get; init; } = string.Empty;
    public bool Internal { get; init; }
}

public sealed class JiraIssuePerson
{
    public string? Name { get; init; }
    public string? DisplayName { get; init; }
}

public sealed class JiraIssueThread
{
    public JiraIssuePerson? Reporter { get; init; }
    public JiraIssuePerson? Assignee { get; init; }
    public JiraIssuePerson? Creator { get; init; }
    public string Description { get; init; } = string.Empty;
    public string Created { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public IReadOnlyList<JiraCommentItem> Comments { get; init; } = [];
}

public sealed class JiraIssueComments
{
    public string Key { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
    public IReadOnlyList<JiraCommentItem> Comments { get; init; } = [];
    public string Status { get; init; } = string.Empty;
}

public sealed class JiraIssueState
{
    public string Key { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? AssigneeName { get; init; }
    public string? AssigneeDisplay { get; init; }
    public string? CreatorName { get; init; }
    public string? CreatorDisplay { get; init; }
}

public sealed class JiraWorklogItem
{
    public string Id { get; init; } = string.Empty;
    public int TimeSpentSeconds { get; init; }
    public string Created { get; init; } = string.Empty;
    public string Updated { get; init; } = string.Empty;

    public int Minutes => Math.Max(0, (int)Math.Round(TimeSpentSeconds / 60.0));

    public bool IsEdited
    {
        get
        {
            if (!DateTime.TryParse(Created, out var created) || !DateTime.TryParse(Updated, out var updated))
            {
                return false;
            }

            return (updated - created).TotalSeconds > 2;
        }
    }
}

public interface IJiraRestClient
{
    Task AddIssueCommentAsync(string jiraKey, string body, bool internalComment = false, CancellationToken cancellationToken = default);
    Task<JiraIssueThread> GetIssueThreadAsync(string jiraKey, CancellationToken cancellationToken = default);
    Task<bool> AssignToMeAsync(string jiraKey, CancellationToken cancellationToken = default);
    Task<JiraCreateMeta> GetSipCreateMetaAsync(CancellationToken cancellationToken = default);
    Task<JiraCreatedIssue> CreateSipIssueAsync(
        string summary,
        string? description,
        string? issueTypeId,
        string? issueTypeName,
        string? componentId,
        string? assigneeName,
        CancellationToken cancellationToken = default);
    Task<string?> GetSummaryAsync(string jiraKey, CancellationToken cancellationToken = default);
    Task<string?> AddWorklogAsync(string jiraKey, int minutes, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JiraWorklogItem>> ListWorklogsAsync(string jiraKey, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JiraIssueRef>> ListUnassignedProductSupportAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JiraIssueComments>> ListRecentlyUpdatedProductSupportAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JiraIssueComments>> SearchIssueCommentsAsync(IReadOnlyList<string> keys, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JiraIssueState>> SearchIssueStatesAsync(IReadOnlyList<string> keys, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JiraUserOption>> SearchAssignableUsersAsync(string projectKey, string? query, CancellationToken cancellationToken = default);
}

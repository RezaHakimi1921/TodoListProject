using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class JiraDoneCommentService
{
    private static int _open;
    private readonly SqliteConnectionFactory _factory;
    private readonly ITaskService _tasks;
    private readonly IJiraRestClient _jiraRest;
    private readonly IJiraCommentInboxService _inbox;
    private readonly ITaskJiraRepository _jiraLinks;
    private readonly IJiraLinkService _jira;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<JiraDoneCommentService> _logger;

    public JiraDoneCommentService(
        SqliteConnectionFactory factory,
        ITaskService tasks,
        IJiraRestClient jiraRest,
        IJiraCommentInboxService inbox,
        ITaskJiraRepository jiraLinks,
        IJiraLinkService jira,
        IServiceScopeFactory scopes,
        ILogger<JiraDoneCommentService> logger)
    {
        _factory = factory;
        _tasks = tasks;
        _jiraRest = jiraRest;
        _inbox = inbox;
        _jiraLinks = jiraLinks;
        _jira = jira;
        _scopes = scopes;
        _logger = logger;
    }

    public async Task PollAsync(CancellationToken cancellationToken = default)
    {
        await EnsureNotificationTicketAsync();
        var allLinked = (await _tasks.ListAsync(null, null, null))
            .Where(row => !string.IsNullOrWhiteSpace(row.JiraKey))
            .ToDictionary(row => row.JiraKey!, row => row, StringComparer.OrdinalIgnoreCase);
        var linked = allLinked;

        try
        {
            var keys = allLinked.Keys.ToList();
            var states = await _jiraRest.SearchIssueStatesAsync(keys, cancellationToken);
            foreach (var state in states)
            {
                if (!allLinked.TryGetValue(state.Key, out var task))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(state.AssigneeName) || !string.IsNullOrWhiteSpace(state.AssigneeDisplay))
                {
                var ownership = JiraRestClient.IsSelf(state.AssigneeName, state.AssigneeDisplay)
                    ? TaskOwnerships.Mine
                    : TaskOwnerships.Other;
                var display = string.IsNullOrWhiteSpace(state.AssigneeDisplay) ? state.AssigneeName : state.AssigneeDisplay;
                if (!string.Equals(task.Ownership, ownership, StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(task.AssigneeDisplay, display, StringComparison.Ordinal)
                    || !string.Equals(task.AssigneeName, state.AssigneeName, StringComparison.Ordinal))
                {
                    if (!string.Equals(task.Ownership, ownership, StringComparison.OrdinalIgnoreCase))
                    {
                        await _tasks.SetOwnershipAsync(task.Id, ownership);
                    }
                    await _jiraLinks.SetAssigneeAsync(task.Id, state.AssigneeName, display);
                    task = await _tasks.GetAsync(task.Id) ?? task;
                    allLinked[state.Key] = task;
                    linked[state.Key] = task;
                }
                }

                if (string.IsNullOrWhiteSpace(state.Status))
                {
                    continue;
                }

                if (JiraRestClient.IsClosedStatus(state.Status)
                    && !string.Equals(task.Status, "Done", StringComparison.OrdinalIgnoreCase))
                {
                    await _tasks.UpdateStatusAsync(task.Id, new UpdateTaskStatusRequest { Status = "Done" });
                    task = await _tasks.GetAsync(task.Id) ?? task;
                    allLinked[state.Key] = task;
                    linked[state.Key] = task;
                }
                else if (!JiraRestClient.IsClosedStatus(state.Status)
                    && string.Equals(task.Status, "Done", StringComparison.OrdinalIgnoreCase))
                {
                    await _tasks.UpdateStatusAsync(task.Id, new UpdateTaskStatusRequest { Status = "Open" });
                    task = await _tasks.GetAsync(task.Id) ?? task;
                    allLinked[state.Key] = task;
                    linked[state.Key] = task;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Jira assignee/status sync failed");
        }

        if (linked.Count == 0)
        {
            return;
        }

        IReadOnlyList<JiraIssueComments> updated;
        try
        {
            updated = await _jiraRest.ListRecentlyUpdatedProductSupportAsync(cancellationToken);
            var extraKeys = allLinked.Keys
                .Where(key => !key.StartsWith("PS-", StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (extraKeys.Count > 0)
            {
                var extra = await _jiraRest.SearchIssueCommentsAsync(extraKeys, cancellationToken);
                updated = updated.Concat(extra).ToList();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Jira comment poll failed");
            return;
        }

        foreach (var issue in updated)
        {
            if (!linked.TryGetValue(issue.Key, out var task))
            {
                continue;
            }

            if (JiraRestClient.IsClosedStatus(issue.Status)
                && !string.Equals(task.Status, "Done", StringComparison.OrdinalIgnoreCase))
            {
                await _tasks.UpdateStatusAsync(task.Id, new UpdateTaskStatusRequest { Status = "Done" });
                task = await _tasks.GetAsync(task.Id) ?? task;
            }

            var newest = issue.Comments
                .Select(row => new { Row = row, Id = ParseId(row.Id) })
                .OrderBy(row => row.Id)
                .ToList();
            if (newest.Count == 0)
            {
                continue;
            }

            var lastSeen = await ReadCursorAsync(issue.Key);
            var incoming = newest.Where(row => row.Id > lastSeen).Select(row => row.Row).ToList();
            await WriteCursorAsync(issue.Key, newest[^1].Id);
            if (lastSeen == 0 || incoming.Count == 0)
            {
                continue;
            }

            var foreign = incoming.Where(row => !IsMe(row)).ToList();
            foreach (var comment in foreign)
            {
                await _inbox.AddIncomingAsync(
                    task.Id,
                    issue.Key,
                    comment.Id,
                    comment.AuthorName,
                    comment.Body,
                    comment.Created);
            }

            if (foreign.Count == 0)
            {
                continue;
            }

            if (string.Equals(task.Status, "Done", StringComparison.OrdinalIgnoreCase))
            {
                Notify(task, issue, foreign[^1]);
            }
        }
    }

    private async Task EnsureNotificationTicketAsync()
    {
        try
        {
            var existing = await _jiraLinks.GetByKeyAsync(ActivityJira.NotificationKey);
            if (existing is not null)
            {
                return;
            }

            await _jira.RegisterAsync(new JiraStartRequest
            {
                JiraKey = ActivityJira.NotificationKey,
                JiraUrl = ActivityJira.BrowseUrl(ActivityJira.NotificationKey),
                Title = ActivityJira.NotificationKey,
                EnergyType = EnergyTypes.Light
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Register notification ticket {Key} failed", ActivityJira.NotificationKey);
        }
    }

    private void Notify(TaskDto task, JiraIssueComments issue, JiraCommentItem comment)
    {
        // Windows Form / toast for Done-task comments disabled — inbox + ntfy cover this.
        _ = task;
        _ = issue;
        _ = comment;
    }

    private async Task<long> ReadCursorAsync(string key)
    {
        using var connection = _factory.Create();
        var value = await connection.ExecuteScalarAsync<string>(
            "SELECT Value FROM AppSettings WHERE Key = @Key",
            new { Key = CursorKey(key) });
        return long.TryParse(value, out var id) ? id : 0;
    }

    private async Task WriteCursorAsync(string key, long id)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync("""
            INSERT INTO AppSettings (Key, Value) VALUES (@Key, @Value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
            """, new { Key = CursorKey(key), Value = id.ToString() });
    }

    public async Task<bool> TryCloseFromJiraAsync(string jiraKey, CancellationToken cancellationToken = default)
    {
        var key = (jiraKey ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(key))
        {
            return false;
        }

        var states = await _jiraRest.SearchIssueStatesAsync([key], cancellationToken);
        var state = states.FirstOrDefault(row => row.Key.Equals(key, StringComparison.OrdinalIgnoreCase));
        if (state is null || !JiraRestClient.IsClosedStatus(state.Status))
        {
            return false;
        }

        var link = await _jiraLinks.GetByKeyAsync(key);
        if (link is null)
        {
            return false;
        }

        var task = await _tasks.GetAsync(link.TaskId);
        if (task is null)
        {
            return false;
        }

        if (string.Equals(task.Status, "Done", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        await _tasks.UpdateStatusAsync(task.Id, new UpdateTaskStatusRequest { Status = "Done" });
        return true;
    }

    private static string CursorKey(string key) => "JiraComment." + key.ToUpperInvariant();

    private static bool IsMe(JiraCommentItem comment)
    {
        var name = (comment.AuthorKey ?? string.Empty).Trim();
        if (name.Equals("reza", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return (comment.AuthorName ?? string.Empty).Trim().Equals("Reza Hakimi", StringComparison.OrdinalIgnoreCase);
    }

    private static long ParseId(string? raw) =>
        long.TryParse(raw, out var id) ? id : 0;

    private static string TrimBody(string? body)
    {
        var text = (body ?? string.Empty).Replace('\n', ' ').Trim();
        return text.Length <= 180 ? text : text[..180] + "\u2026";
    }
}

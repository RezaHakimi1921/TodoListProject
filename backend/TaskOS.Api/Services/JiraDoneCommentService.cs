using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public sealed class JiraDoneCommentService
{
    private static int _open;
    private readonly SqliteConnectionFactory _factory;
    private readonly ITaskService _tasks;
    private readonly IJiraRestClient _jiraRest;
    private readonly IJiraCommentInboxService _inbox;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<JiraDoneCommentService> _logger;

    public JiraDoneCommentService(
        SqliteConnectionFactory factory,
        ITaskService tasks,
        IJiraRestClient jiraRest,
        IJiraCommentInboxService inbox,
        IServiceScopeFactory scopes,
        ILogger<JiraDoneCommentService> logger)
    {
        _factory = factory;
        _tasks = tasks;
        _jiraRest = jiraRest;
        _inbox = inbox;
        _scopes = scopes;
        _logger = logger;
    }

    public async Task PollAsync(CancellationToken cancellationToken = default)
    {
        var linked = (await _tasks.ListAsync(null, null, null))
            .Where(row => !string.IsNullOrWhiteSpace(row.JiraKey)
                          && row.JiraKey.StartsWith("PS-", StringComparison.OrdinalIgnoreCase))
            .ToDictionary(row => row.JiraKey!, row => row, StringComparer.OrdinalIgnoreCase);
        if (linked.Count == 0)
        {
            return;
        }

        IReadOnlyList<JiraIssueComments> updated;
        try
        {
            updated = await _jiraRest.ListRecentlyUpdatedProductSupportAsync(cancellationToken);
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

    private void Notify(TaskDto task, JiraIssueComments issue, JiraCommentItem comment)
    {
        var snippet = TrimBody(comment.Body);
        var author = string.IsNullOrWhiteSpace(comment.AuthorName) ? "کسی" : comment.AuthorName;
        try
        {
            WindowsToast.Show("TaskOS", $"این تسک دان شده، کامنت جدید گذاشته شده\n{task.Title}\n{author}: {snippet}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Done-comment toast failed for {Key}", issue.Key);
        }

        if (Interlocked.CompareExchange(ref _open, 1, 0) != 0)
        {
            return;
        }

        var taskTitle = task.Title;
        var jiraKey = issue.Key;
        var jiraUrl = task.JiraUrl ?? $"https://jira.smartx.ir/browse/{issue.Key}";
        _ = Task.Run(() =>
        {
            try
            {
                var choice = DoneCommentForm.ShowCentered(taskTitle, $"{author}: {snippet}");
                if (choice != DoneCommentChoice.ReturnToTask)
                {
                    return;
                }

                using var scope = _scopes.CreateScope();
                var settings = scope.ServiceProvider.GetRequiredService<ISettingsService>().GetAsync().GetAwaiter().GetResult();
                var jira = scope.ServiceProvider.GetRequiredService<IJiraLinkService>();
                jira.StartAsync(new JiraStartRequest
                {
                    JiraKey = jiraKey,
                    JiraUrl = jiraUrl,
                    Title = taskTitle,
                    FinishPrevious = true,
                    DurationMinutes = settings.PingMinutes
                }).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Done-comment form failed for {Key}", jiraKey);
            }
            finally
            {
                Interlocked.Exchange(ref _open, 0);
            }
        });
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

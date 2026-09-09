using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TaskOS.Api.Services;

public sealed class JiraRestException : Exception
{
    public JiraRestException(int statusCode, string responseBody)
        : base($"Jira HTTP {statusCode}")
    {
        StatusCode = statusCode;
        ResponseBody = responseBody;
    }

    public int StatusCode { get; }
    public string ResponseBody { get; }
}

public sealed class JiraRestClient : IJiraRestClient
{
    private static readonly Regex KeyPattern = new(@"^[A-Z][A-Z0-9]+-\d+$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    private const string UnassignedJql =
        "project = PS AND assignee is EMPTY AND resolution is EMPTY";
    private const string RecentJql = "project = PS AND updated >= -1d";

    private readonly HttpClient _http;

    public JiraRestClient(HttpClient http)
    {
        _http = http;
    }

    public async Task AddIssueCommentAsync(string jiraKey, string body, CancellationToken cancellationToken = default)
    {
        var key = RequireKey(jiraKey);
        var text = (body ?? string.Empty).Trim();
        if (text.Length == 0)
        {
            throw new ArgumentException("Comment body is required.");
        }

        using var response = await _http.PostAsJsonAsync(
            $"rest/api/2/issue/{Uri.EscapeDataString(key)}/comment",
            new { body = text },
            cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new JiraRestException((int)response.StatusCode, raw);
    }

    public async Task<bool> AssignToMeAsync(string jiraKey, CancellationToken cancellationToken = default)
    {
        var key = RequireKey(jiraKey);
        if (!key.StartsWith("PS-", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        using var response = await _http.PutAsJsonAsync(
            $"rest/api/2/issue/{Uri.EscapeDataString(key)}/assignee",
            new { name = "reza" },
            cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public async Task<string?> GetSummaryAsync(string jiraKey, CancellationToken cancellationToken = default)
    {
        var key = RequireKey(jiraKey);
        using var response = await _http.GetAsync(
            $"rest/api/2/issue/{Uri.EscapeDataString(key)}?fields=summary",
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return doc.RootElement.GetProperty("fields").GetProperty("summary").GetString();
    }

    public async Task<string?> AddWorklogAsync(string jiraKey, int minutes, CancellationToken cancellationToken = default)
    {
        var key = RequireKey(jiraKey);
        var spent = Math.Clamp(minutes, 1, 480);
        using var response = await _http.PostAsJsonAsync(
            $"rest/api/2/issue/{Uri.EscapeDataString(key)}/worklog",
            new { timeSpent = spent + "m" },
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() : null;
    }

    public async Task<IReadOnlyList<JiraIssueRef>> ListUnassignedProductSupportAsync(CancellationToken cancellationToken = default)
    {
        var url = $"rest/api/2/search?jql={Uri.EscapeDataString(UnassignedJql)}&fields=summary,assignee,status&maxResults=50";
        using var response = await _http.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return [];
        }

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        if (!doc.RootElement.TryGetProperty("issues", out var issues) || issues.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var rows = new List<JiraIssueRef>();
        foreach (var issue in issues.EnumerateArray())
        {
            var key = issue.TryGetProperty("key", out var keyEl) ? keyEl.GetString() : null;
            if (string.IsNullOrWhiteSpace(key) || !key.StartsWith("PS-", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var fields = issue.TryGetProperty("fields", out var fieldsEl) ? fieldsEl : default;
            var statusName = fields.ValueKind == JsonValueKind.Object
                && fields.TryGetProperty("status", out var statusEl)
                && statusEl.TryGetProperty("name", out var statusNameEl)
                ? statusNameEl.GetString() ?? ""
                : "";
            if (IsClosedStatus(statusName))
            {
                continue;
            }

            var summary = fields.ValueKind == JsonValueKind.Object && fields.TryGetProperty("summary", out var summaryEl)
                ? summaryEl.GetString()
                : null;
            rows.Add(new JiraIssueRef { Key = key.ToUpperInvariant(), Summary = summary?.Trim() ?? key });
        }

        return rows;
    }

    public async Task<IReadOnlyList<JiraIssueComments>> ListRecentlyUpdatedProductSupportAsync(CancellationToken cancellationToken = default)
    {
        var url = $"rest/api/2/search?jql={Uri.EscapeDataString(RecentJql)}&fields=summary,comment&maxResults=50";
        using var response = await _http.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return [];
        }

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        if (!doc.RootElement.TryGetProperty("issues", out var issues) || issues.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var rows = new List<JiraIssueComments>();
        foreach (var issue in issues.EnumerateArray())
        {
            var key = issue.TryGetProperty("key", out var keyEl) ? keyEl.GetString() : null;
            if (string.IsNullOrWhiteSpace(key) || !key.StartsWith("PS-", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var fields = issue.TryGetProperty("fields", out var fieldsEl) ? fieldsEl : default;
            var summary = fields.ValueKind == JsonValueKind.Object && fields.TryGetProperty("summary", out var summaryEl)
                ? summaryEl.GetString()
                : null;
            var comments = new List<JiraCommentItem>();
            if (fields.ValueKind == JsonValueKind.Object
                && fields.TryGetProperty("comment", out var commentEl)
                && commentEl.TryGetProperty("comments", out var list)
                && list.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in list.EnumerateArray())
                {
                    var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    if (string.IsNullOrWhiteSpace(id))
                    {
                        continue;
                    }

                    var author = item.TryGetProperty("author", out var authorEl) ? authorEl : default;
                    comments.Add(new JiraCommentItem
                    {
                        Id = id,
                        Body = item.TryGetProperty("body", out var bodyEl) ? bodyEl.GetString() ?? "" : "",
                        Created = item.TryGetProperty("created", out var createdEl) ? createdEl.GetString() ?? "" : "",
                        AuthorName = author.ValueKind == JsonValueKind.Object && author.TryGetProperty("displayName", out var nameEl)
                            ? nameEl.GetString() ?? ""
                            : "",
                        AuthorKey = author.ValueKind == JsonValueKind.Object && author.TryGetProperty("name", out var keyNameEl)
                            ? keyNameEl.GetString() ?? ""
                            : ""
                    });
                }
            }

            rows.Add(new JiraIssueComments
            {
                Key = key.ToUpperInvariant(),
                Summary = summary?.Trim() ?? key,
                Comments = comments
            });
        }

        return rows;
    }

    private static string RequireKey(string? jiraKey)
    {
        var key = (jiraKey ?? string.Empty).Trim().ToUpperInvariant();
        if (!KeyPattern.IsMatch(key))
        {
            throw new ArgumentException("jiraKey must look like PROJ-123.");
        }

        return key;
    }

    private static bool IsClosedStatus(string? name)
    {
        var value = (name ?? string.Empty).Trim().ToLowerInvariant();
        return value is "done" or "not solvable" or "canceled" or "cancelled"
            or "request completed" or "request cancelled" or "request canceled"
            or "انجام شده" or "لغو شده";
    }
}

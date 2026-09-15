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
    private const string CreateProject = "SIP";

    private readonly HttpClient _http;

    public JiraRestClient(HttpClient http)
    {
        _http = http;
    }

    public async Task AddIssueCommentAsync(string jiraKey, string body, bool internalComment = false, CancellationToken cancellationToken = default)
    {
        var key = RequireKey(jiraKey);
        var text = (body ?? string.Empty).Trim();
        if (text.Length == 0)
        {
            throw new ArgumentException("Comment body is required.");
        }

        // Jira Service Desk: sd.public.comment.internal true = team-only, false = share with customer
        var payload = new Dictionary<string, object?>
        {
            ["body"] = text,
            ["properties"] = new object[]
            {
                new Dictionary<string, object?>
                {
                    ["key"] = "sd.public.comment",
                    ["value"] = new Dictionary<string, object?>
                    {
                        ["internal"] = internalComment,
                    },
                },
            },
        };

        using var response = await _http.PostAsJsonAsync(
            $"rest/api/2/issue/{Uri.EscapeDataString(key)}/comment",
            payload,
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

        using (var current = await _http.GetAsync(
            $"rest/api/2/issue/{Uri.EscapeDataString(key)}?fields=assignee",
            cancellationToken))
        {
            if (!current.IsSuccessStatusCode)
            {
                return false;
            }

            using var doc = JsonDocument.Parse(await current.Content.ReadAsStringAsync(cancellationToken));
            var fields = doc.RootElement.TryGetProperty("fields", out var fieldsEl) ? fieldsEl : default;
            var assignee = fields.ValueKind == JsonValueKind.Object && fields.TryGetProperty("assignee", out var assigneeEl)
                ? assigneeEl
                : default;
            var parsed = ReadAssignee(assignee);
            if (parsed.Present)
            {
                return IsSelf(parsed.Name, parsed.Display);
            }
        }

        using var response = await _http.PutAsJsonAsync(
            $"rest/api/2/issue/{Uri.EscapeDataString(key)}/assignee",
            new { name = "reza" },
            cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public static bool IsSelf(string? name, string? displayName = null)
    {
        var user = (name ?? string.Empty).Trim().ToLowerInvariant();
        var display = (displayName ?? string.Empty).Trim().ToLowerInvariant();
        return user is "reza"
            || display.Contains("reza hakimi", StringComparison.Ordinal)
            || display.Contains("رضا حکیمی", StringComparison.Ordinal);
    }

    public async Task<JiraCreateMeta> GetSipCreateMetaAsync(CancellationToken cancellationToken = default)
    {
        var issueTypes = new List<JiraNamedOption>();
        var components = new List<JiraNamedOption>();
        var assignees = new List<JiraUserOption>();

        using (var response = await _http.GetAsync(
            $"rest/api/2/issue/createmeta?projectKeys={CreateProject}&expand=projects.issuetypes",
            cancellationToken))
        {
            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                if (doc.RootElement.TryGetProperty("projects", out var projects) && projects.ValueKind == JsonValueKind.Array)
                {
                    foreach (var project in projects.EnumerateArray())
                    {
                        if (!project.TryGetProperty("issuetypes", out var types) || types.ValueKind != JsonValueKind.Array)
                        {
                            continue;
                        }

                        foreach (var type in types.EnumerateArray())
                        {
                            var id = type.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                            var name = type.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                            if (!string.IsNullOrWhiteSpace(id))
                            {
                                issueTypes.Add(new JiraNamedOption { Id = id, Name = name ?? id });
                            }
                        }
                    }
                }
            }
        }

        if (issueTypes.Count == 0)
        {
            using var projectResponse = await _http.GetAsync($"rest/api/2/project/{CreateProject}", cancellationToken);
            if (projectResponse.IsSuccessStatusCode)
            {
                using var projectDoc = JsonDocument.Parse(await projectResponse.Content.ReadAsStringAsync(cancellationToken));
                if (projectDoc.RootElement.TryGetProperty("issueTypes", out var projectTypes) && projectTypes.ValueKind == JsonValueKind.Array)
                {
                    foreach (var type in projectTypes.EnumerateArray())
                    {
                        var id = type.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                        var name = type.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                        if (!string.IsNullOrWhiteSpace(id))
                        {
                            issueTypes.Add(new JiraNamedOption { Id = id, Name = name ?? id });
                        }
                    }
                }
            }
        }

        using (var response = await _http.GetAsync($"rest/api/2/project/{CreateProject}/components", cancellationToken))
        {
            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in doc.RootElement.EnumerateArray())
                    {
                        var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                        var name = item.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                        if (!string.IsNullOrWhiteSpace(id))
                        {
                            components.Add(new JiraNamedOption { Id = id, Name = name ?? id });
                        }
                    }
                }
            }
        }

        using (var response = await _http.GetAsync(
            $"rest/api/2/user/assignable/search?project={CreateProject}&maxResults=50",
            cancellationToken))
        {
            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in doc.RootElement.EnumerateArray())
                    {
                        var name = item.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                        var display = item.TryGetProperty("displayName", out var displayEl) ? displayEl.GetString() : null;
                        if (!string.IsNullOrWhiteSpace(name))
                        {
                            assignees.Add(new JiraUserOption { Name = name, DisplayName = display ?? name });
                        }
                    }
                }
            }
        }

        if (assignees.Count == 0 || assignees.All(row => !IsSelf(row.Name, row.DisplayName)))
        {
            assignees.Insert(0, new JiraUserOption { Name = "reza", DisplayName = "Reza Hakimi" });
        }

        return new JiraCreateMeta
        {
            ProjectKey = CreateProject,
            IssueTypes = issueTypes,
            Components = components,
            Assignees = assignees
        };
    }

    public async Task<JiraCreatedIssue> CreateSipIssueAsync(
        string summary,
        string? description,
        string? issueTypeId,
        string? issueTypeName,
        string? componentId,
        string? assigneeName,
        CancellationToken cancellationToken = default)
    {
        var title = (summary ?? string.Empty).Trim();
        if (title.Length == 0)
        {
            throw new ArgumentException("Title is required.");
        }

        var typeId = (issueTypeId ?? string.Empty).Trim();
        if (typeId.Length == 0)
        {
            typeId = await ResolveSipIssueTypeIdAsync(issueTypeName, cancellationToken);
        }

        var fields = new Dictionary<string, object?>
        {
            ["project"] = new { key = CreateProject },
            ["summary"] = title,
            ["issuetype"] = new { id = typeId },
            ["assignee"] = new { name = string.IsNullOrWhiteSpace(assigneeName) ? "reza" : assigneeName.Trim() }
        };
        if (!string.IsNullOrWhiteSpace(description))
        {
            fields["description"] = description.Trim();
        }

        if (!string.IsNullOrWhiteSpace(componentId))
        {
            fields["components"] = new[] { new { id = componentId.Trim() } };
        }

        using var response = await _http.PostAsJsonAsync("rest/api/2/issue", new { fields }, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new JiraRestException((int)response.StatusCode, raw);
        }

        using var doc = JsonDocument.Parse(raw);
        var key = doc.RootElement.TryGetProperty("key", out var keyEl) ? keyEl.GetString() : null;
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new JiraRestException((int)response.StatusCode, raw);
        }

        var baseUrl = (_http.BaseAddress?.ToString() ?? "https://jira.smartx.ir/").TrimEnd('/');
        return new JiraCreatedIssue
        {
            Key = key.ToUpperInvariant(),
            BrowseUrl = $"{baseUrl}/browse/{key}",
            Summary = title
        };
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

    public async Task<IReadOnlyList<JiraWorklogItem>> ListWorklogsAsync(string jiraKey, CancellationToken cancellationToken = default)
    {
        var key = RequireKey(jiraKey);
        var rows = new List<JiraWorklogItem>();
        var startAt = 0;
        const int pageSize = 100;
        while (true)
        {
            using var response = await _http.GetAsync(
                $"rest/api/2/issue/{Uri.EscapeDataString(key)}/worklog?startAt={startAt}&maxResults={pageSize}",
                cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                break;
            }

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            var root = doc.RootElement;
            var total = root.TryGetProperty("total", out var totalEl) && totalEl.TryGetInt32(out var totalVal)
                ? totalVal
                : 0;
            if (!root.TryGetProperty("worklogs", out var logs) || logs.ValueKind != JsonValueKind.Array)
            {
                break;
            }

            var pageCount = 0;
            foreach (var item in logs.EnumerateArray())
            {
                pageCount++;
                var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(id))
                {
                    continue;
                }

                var seconds = item.TryGetProperty("timeSpentSeconds", out var secEl) && secEl.TryGetInt32(out var sec)
                    ? sec
                    : 0;
                rows.Add(new JiraWorklogItem
                {
                    Id = id,
                    TimeSpentSeconds = seconds,
                    Created = item.TryGetProperty("created", out var createdEl) ? createdEl.GetString() ?? string.Empty : string.Empty,
                    Updated = item.TryGetProperty("updated", out var updatedEl) ? updatedEl.GetString() ?? string.Empty : string.Empty
                });
            }

            if (pageCount == 0 || rows.Count >= total)
            {
                break;
            }

            startAt += pageCount;
        }

        return rows;
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
        var url = $"rest/api/2/search?jql={Uri.EscapeDataString(RecentJql)}&fields=summary,comment,status&maxResults=50";
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
                Comments = comments,
                Status = fields.ValueKind == JsonValueKind.Object
                    && fields.TryGetProperty("status", out var statusEl)
                    && statusEl.TryGetProperty("name", out var statusNameEl)
                    ? statusNameEl.GetString() ?? ""
                    : ""
            });
        }

        return rows;
    }

    private async Task<string> ResolveSipIssueTypeIdAsync(string? preferredName, CancellationToken cancellationToken)
    {
        var url = $"rest/api/2/issue/createmeta?projectKeys={CreateProject}&expand=projects.issuetypes";
        using var response = await _http.GetAsync(url, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new JiraRestException((int)response.StatusCode, raw);
        }

        using var doc = JsonDocument.Parse(raw);
        if (!doc.RootElement.TryGetProperty("projects", out var projects) || projects.ValueKind != JsonValueKind.Array)
        {
            throw new JiraRestException((int)response.StatusCode, raw);
        }

        var types = new List<(string Id, string Name)>();
        foreach (var project in projects.EnumerateArray())
        {
            if (!project.TryGetProperty("issuetypes", out var issueTypes) || issueTypes.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var type in issueTypes.EnumerateArray())
            {
                var id = type.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                var name = type.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                if (!string.IsNullOrWhiteSpace(id))
                {
                    types.Add((id, name ?? ""));
                }
            }
        }

        if (types.Count == 0)
        {
            using var projectResponse = await _http.GetAsync($"rest/api/2/project/{CreateProject}", cancellationToken);
            if (projectResponse.IsSuccessStatusCode)
            {
                using var projectDoc = JsonDocument.Parse(await projectResponse.Content.ReadAsStringAsync(cancellationToken));
                if (projectDoc.RootElement.TryGetProperty("issueTypes", out var projectTypes) && projectTypes.ValueKind == JsonValueKind.Array)
                {
                    foreach (var type in projectTypes.EnumerateArray())
                    {
                        var id = type.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                        var name = type.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                        if (!string.IsNullOrWhiteSpace(id))
                        {
                            types.Add((id, name ?? ""));
                        }
                    }
                }
            }
        }

        if (types.Count == 0)
        {
            throw new InvalidOperationException("SIP issue types were not found.");
        }

        var preferred = (preferredName ?? string.Empty).Trim();
        var match = types.FirstOrDefault(type =>
            preferred.Length > 0 && type.Name.Equals(preferred, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(match.Id))
        {
            return match.Id;
        }

        foreach (var name in new[] { "Task", "Story", "Bug", "Service Request" })
        {
            match = types.FirstOrDefault(type => type.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(match.Id))
            {
                return match.Id;
            }
        }

        return types[0].Id;
    }

    public async Task<IReadOnlyList<JiraIssueComments>> SearchIssueCommentsAsync(IReadOnlyList<string> keys, CancellationToken cancellationToken = default)
    {
        var valid = keys
            .Select(key => (key ?? string.Empty).Trim().ToUpperInvariant())
            .Where(key => KeyPattern.IsMatch(key))
            .Distinct()
            .ToList();
        var rows = new List<JiraIssueComments>();
        foreach (var batch in valid.Chunk(40))
        {
            var jql = "key in (" + string.Join(",", batch) + ")";
            var url = $"rest/api/2/search?jql={Uri.EscapeDataString(jql)}&fields=summary,comment,status&maxResults=50";
            using var response = await _http.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                continue;
            }

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            if (!doc.RootElement.TryGetProperty("issues", out var issues) || issues.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var issue in issues.EnumerateArray())
            {
                var parsed = ParseIssueComments(issue);
                if (parsed is not null)
                {
                    rows.Add(parsed);
                }
            }
        }

        return rows;
    }
    public async Task<IReadOnlyList<JiraIssueState>> SearchIssueStatesAsync(IReadOnlyList<string> keys, CancellationToken cancellationToken = default)
    {
        var valid = keys
            .Select(key => (key ?? string.Empty).Trim().ToUpperInvariant())
            .Where(key => KeyPattern.IsMatch(key))
            .Distinct()
            .ToList();
        var rows = new List<JiraIssueState>();
        foreach (var batch in valid.Chunk(40))
        {
            var jql = "key in (" + string.Join(",", batch) + ")";
            var url = $"rest/api/2/search?jql={Uri.EscapeDataString(jql)}&fields=status,assignee&maxResults=50";
            using var response = await _http.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                continue;
            }

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            if (!doc.RootElement.TryGetProperty("issues", out var issues) || issues.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var issue in issues.EnumerateArray())
            {
                var key = issue.TryGetProperty("key", out var keyEl) ? keyEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(key))
                {
                    continue;
                }

                var fields = issue.TryGetProperty("fields", out var fieldsEl) ? fieldsEl : default;
                var status = fields.ValueKind == JsonValueKind.Object
                    && fields.TryGetProperty("status", out var statusEl)
                    && statusEl.TryGetProperty("name", out var statusNameEl)
                    ? statusNameEl.GetString() ?? ""
                    : "";
                var assignee = fields.ValueKind == JsonValueKind.Object && fields.TryGetProperty("assignee", out var assigneeEl)
                    ? assigneeEl
                    : default;
                var parsed = ReadAssignee(assignee);
                rows.Add(new JiraIssueState
                {
                    Key = key.ToUpperInvariant(),
                    Status = status,
                    AssigneeName = parsed.Name,
                    AssigneeDisplay = parsed.Display
                });
            }
        }

        return rows;
    }


    public async Task<IReadOnlyList<JiraUserOption>> SearchAssignableUsersAsync(string projectKey, string? query, CancellationToken cancellationToken = default)
    {
        var project = string.IsNullOrWhiteSpace(projectKey) ? CreateProject : projectKey.Trim().ToUpperInvariant();
        var q = (query ?? string.Empty).Trim();
        var url = string.IsNullOrWhiteSpace(q)
            ? $"rest/api/2/user/assignable/search?project={Uri.EscapeDataString(project)}&maxResults=30"
            : $"rest/api/2/user/assignable/search?project={Uri.EscapeDataString(project)}&username={Uri.EscapeDataString(q)}&maxResults=30";

        using var response = await _http.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var raw = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new JiraRestException((int)response.StatusCode, raw);
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var users = new List<JiraUserOption>();
        if (doc.RootElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in doc.RootElement.EnumerateArray())
            {
                var name = row.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                if (string.IsNullOrWhiteSpace(name)) continue;
                var display = row.TryGetProperty("displayName", out var displayEl) ? displayEl.GetString() : name;
                users.Add(new JiraUserOption { Name = name, DisplayName = display ?? name });
            }
        }

        return users;
    }
    private static JiraIssueComments? ParseIssueComments(JsonElement issue)
    {
        var key = issue.TryGetProperty("key", out var keyEl) ? keyEl.GetString() : null;
        if (string.IsNullOrWhiteSpace(key))
        {
            return null;
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

        return new JiraIssueComments
        {
            Key = key.ToUpperInvariant(),
            Summary = summary?.Trim() ?? key,
            Comments = comments,
            Status = fields.ValueKind == JsonValueKind.Object
                && fields.TryGetProperty("status", out var statusEl)
                && statusEl.TryGetProperty("name", out var statusNameEl)
                ? statusNameEl.GetString() ?? ""
                : ""
        };
    }
    private static (bool Present, string? Name, string? Display) ReadAssignee(JsonElement assignee)
    {
        if (assignee.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return (false, null, null);
        }

        if (assignee.ValueKind != JsonValueKind.Object)
        {
            return (true, null, null);
        }

        var name = assignee.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
        if (string.IsNullOrWhiteSpace(name) && assignee.TryGetProperty("key", out var keyEl))
        {
            name = keyEl.GetString();
        }

        var display = assignee.TryGetProperty("displayName", out var displayEl) ? displayEl.GetString() : null;
        return (true, name, display);
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

    public static bool IsClosedStatus(string? name)
    {
        var value = (name ?? string.Empty).Trim().ToLowerInvariant();
        return value is "done" or "not solvable" or "canceled" or "cancelled"
            or "request completed" or "request cancelled" or "request canceled"
            or "انجام شده" or "لغو شده";
    }
}

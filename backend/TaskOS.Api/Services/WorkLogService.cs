using System.Globalization;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;
using TaskOS.Api.Services.Similarity;

namespace TaskOS.Api.Services;

public sealed class WorkLogService : IWorkLogService
{
    private readonly IWorkLogRepository _logs;
    private readonly ITaskService _tasks;
    private readonly ITaskJiraRepository _jiraLinks;
    private readonly IJiraRestClient _jiraRest;
    private readonly ILogger<WorkLogService> _logger;
    private readonly double _clusterThreshold;

    public WorkLogService(
        IWorkLogRepository logs,
        ITaskService tasks,
        ITaskJiraRepository jiraLinks,
        IJiraRestClient jiraRest,
        IConfiguration configuration,
        ILogger<WorkLogService> logger)
    {
        _logs = logs;
        _tasks = tasks;
        _jiraLinks = jiraLinks;
        _jiraRest = jiraRest;
        _logger = logger;
        _clusterThreshold = configuration.GetValue("TaskOS:WorkLogClusterThreshold", 0.5);
    }

    public async Task<WorkLogDto> CaptureAsync(CaptureWorkLogRequest request)
    {
        var minutes = request.DurationMinutes ?? 15;
        if (minutes is < 1 or > 480)
        {
            throw new ArgumentException("durationMinutes must be between 1 and 480.");
        }

        var source = string.IsNullOrWhiteSpace(request.Source) ? WorkLogSources.Manual : request.Source.Trim();
        if (!WorkLogSources.All.Contains(source))
        {
            throw new ArgumentException("Source must be Timer, Extension, Manual, or Break.");
        }

        var description = await SanitizeDescriptionAsync(request, source);
        if (IsAutomatic(source) && request.TaskId is int taskId)
        {
            var recent = await _logs.FindRecentAsync(taskId, source, TimeSpan.FromMinutes(6));
            if (recent is not null)
            {
                if (minutes <= recent.DurationMinutes)
                {
                    return ToDto(recent);
                }

                var extra = minutes - recent.DurationMinutes;
                if (DateTime.TryParse(recent.CreatedAt, out var recentAt))
                {
                    var recentUtc = recentAt.Kind == DateTimeKind.Unspecified
                        ? DateTime.SpecifyKind(recentAt, DateTimeKind.Utc)
                        : recentAt.ToUniversalTime();
                    var sinceRecent = (int)Math.Round((DateTime.UtcNow - recentUtc).TotalMinutes);
                    extra = Math.Min(extra, Math.Max(0, sinceRecent + 1));
                }

                if (extra < 1)
                {
                    return ToDto(recent);
                }

                await _logs.AddMinutesAsync(recent.Id, extra);
                recent.DurationMinutes += extra;
                await TryPostJiraWorklogAsync(taskId, extra);
                return ToDto(recent);
            }
        }

        var created = await _logs.CreateAsync(new WorkLogEntry
        {
            Description = description,
            DurationMinutes = minutes,
            Source = source,
            TaskId = request.TaskId,
            ProblemId = request.ProblemId,
            CreatedAt = TaskMapping.Now()
        });

        if (request.TaskId is int linkedTaskId)
        {
            created.JiraWorklogId = await TryPostJiraWorklogAsync(linkedTaskId, minutes);
            if (!string.IsNullOrWhiteSpace(created.JiraWorklogId))
            {
                await _logs.SetJiraWorklogIdAsync(created.Id, created.JiraWorklogId);
            }
        }

        return ToDto(created);
    }

    public async Task<IReadOnlyList<WorkLogDto>> ListByDateAsync(string logDate)
    {
        var date = NormalizeDate(logDate);
        var rows = (await _logs.ListByDateAsync(date)).ToList();
        await ReconcileJiraDurationsAsync(rows);
        return rows.Select(ToDto).ToList();
    }

    public async Task<WorkLogSummaryDto> GetSummaryAsync(string logDate)
    {
        var date = NormalizeDate(logDate);
        var rows = (await _logs.ListByDateAsync(date)).ToList();
        await ReconcileJiraDurationsAsync(rows);
        return WorkLogClusterer.Cluster(date, rows, _clusterThreshold);
    }

    public async Task<EntityWorkLogDto> ListByTaskAsync(int taskId)
    {
        var rows = (await _logs.ListByTaskAsync(taskId)).ToList();
        await ReconcileJiraDurationsAsync(rows);
        return ToEntity(rows);
    }

    public async Task<EntityWorkLogDto> ListByProblemAsync(int problemId)
    {
        var rows = (await _logs.ListByProblemAsync(problemId)).ToList();
        await ReconcileJiraDurationsAsync(rows);
        return ToEntity(rows);
    }

    public async Task<WorkLogDto> UpdateDescriptionAsync(int id, string description)
    {
        var existing = await _logs.GetByIdAsync(id);
        if (existing is null)
        {
            throw new KeyNotFoundException("Work log was not found.");
        }

        var text = (description ?? string.Empty).Trim();
        if (text.Length == 0)
        {
            text = "کار";
        }

        await _logs.SetDescriptionAsync(id, text);
        var updated = await _logs.GetByIdAsync(id) ?? existing;
        updated.Description = text;
        return ToDto(updated);
    }
    public static WorkLogDto ToDto(WorkLogEntry entry) => new()
    {
        Id = entry.Id,
        Description = entry.Description,
        DurationMinutes = entry.DurationMinutes,
        Source = entry.Source,
        TaskId = entry.TaskId,
        ProblemId = entry.ProblemId,
        CreatedAt = entry.CreatedAt,
        JiraWorklogId = entry.JiraWorklogId,
        TaskTitle = entry.TaskTitle,
        JiraKey = entry.JiraKey,
        ProblemTitle = entry.ProblemTitle
    };

    private async Task<string> SanitizeDescriptionAsync(CaptureWorkLogRequest request, string source)
    {
        var text = (request.Description ?? string.Empty).Trim();
        if (source.Equals(WorkLogSources.Break, StringComparison.OrdinalIgnoreCase))
        {
            return text.Length == 0 ? "استراحت" : text;
        }
        if (request.TaskId is int taskId)
        {
            var task = await _tasks.GetAsync(taskId);
            if (task is not null &&
                (string.IsNullOrWhiteSpace(text) || string.Equals(text, task.Title, StringComparison.OrdinalIgnoreCase)))
            {
                return "کار";
            }
        }

        if (IsAutomatic(source) && !string.IsNullOrWhiteSpace(text) && request.TaskId is not null)
        {
            return "کار";
        }

        return text.Length == 0 ? "کار" : text;
    }

    private async Task ReconcileJiraDurationsAsync(IList<WorkLogEntry> rows)
    {
        var keys = rows
            .Select(row => row.JiraKey)
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var key in keys)
        {
            IReadOnlyList<JiraWorklogItem> remote;
            try
            {
                remote = await _jiraRest.ListWorklogsAsync(key!);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Jira worklog read failed for {JiraKey}", key);
                continue;
            }

            var byId = new Dictionary<string, JiraWorklogItem>(StringComparer.Ordinal);
            foreach (var item in remote)
            {
                if (!string.IsNullOrWhiteSpace(item.Id))
                {
                    byId[item.Id] = item;
                }
            }

            foreach (var row in rows)
            {
                if (!string.Equals(row.JiraKey, key, StringComparison.OrdinalIgnoreCase)
                    || string.IsNullOrWhiteSpace(row.JiraWorklogId)
                    || !byId.TryGetValue(row.JiraWorklogId, out var jira)
                    || jira.Minutes == row.DurationMinutes)
                {
                    continue;
                }

                await _logs.SetDurationMinutesAsync(row.Id, jira.Minutes);
                row.DurationMinutes = jira.Minutes;
            }
        }
    }

    private async Task<string?> TryPostJiraWorklogAsync(int taskId, int minutes)
    {
        try
        {
            var link = await _jiraLinks.GetByTaskIdAsync(taskId);
            if (link is null || string.IsNullOrWhiteSpace(link.JiraKey))
            {
                return null;
            }

            return await _jiraRest.AddWorklogAsync(link.JiraKey, minutes);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Jira worklog post failed for task {TaskId}", taskId);
            return null;
        }
    }

    private static EntityWorkLogDto ToEntity(IReadOnlyList<WorkLogEntry> rows) => new()
    {
        TotalMinutes = rows.Sum(item => item.DurationMinutes),
        Entries = rows.Select(ToDto).ToList()
    };

    private static bool IsAutomatic(string source) =>
        source.Equals(WorkLogSources.Timer, StringComparison.OrdinalIgnoreCase)
        || source.Equals(WorkLogSources.Extension, StringComparison.OrdinalIgnoreCase);

    private static string NormalizeDate(string logDate)
    {
        if (!DateOnly.TryParseExact(logDate.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            throw new ArgumentException("date must be yyyy-MM-dd.");
        }

        return parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }
}

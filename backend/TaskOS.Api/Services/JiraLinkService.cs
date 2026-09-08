using System.Text.RegularExpressions;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class JiraLinkService : IJiraLinkService
{
    private static readonly Regex KeyPattern = new(@"^[A-Z][A-Z0-9]+-\d+$", RegexOptions.CultureInvariant);
    private static readonly Regex KeyInText = new(@"[A-Z][A-Z0-9]+-\d+", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private readonly ITaskJiraRepository _links;
    private readonly ITaskService _tasks;
    private readonly IFocusService _focus;

    public JiraLinkService(ITaskJiraRepository links, ITaskService tasks, IFocusService focus)
    {
        _links = links;
        _tasks = tasks;
        _focus = focus;
    }

    public async Task<JiraSeenDto> SeenAsync(JiraSeenRequest request)
    {
        var key = NormalizeKey(request.JiraKey, request.JiraUrl);
        var title = string.IsNullOrWhiteSpace(request.Title) ? key : request.Title.Trim();
        var match = await _links.GetByKeyAsync(key);
        var focus = await _focus.GetAsync();
        var focusLink = focus.TaskId is int focusTaskId
            ? await _links.GetByTaskIdAsync(focusTaskId)
            : null;

        if (match is not null && focus.Active && focus.TaskId == match.TaskId)
        {
            await _links.UpsertAsync(match.TaskId, key, request.JiraUrl ?? match.JiraUrl, match.OpenCount + 1, TaskMapping.Now());
            match.OpenCount++;
            return Result(key, request.JiraUrl, title, "continue", match, focus, focusLink?.JiraKey);
        }

        if (focus.Active && !string.Equals(focusLink?.JiraKey, key, StringComparison.OrdinalIgnoreCase))
        {
            return Result(key, request.JiraUrl, title, "ask-switch", match, focus, focusLink?.JiraKey);
        }

        if (match is not null)
        {
            return Result(key, request.JiraUrl, title, "ask-start", match, focus, focusLink?.JiraKey);
        }

        return Result(key, request.JiraUrl, title, "ask-create", null, focus, focusLink?.JiraKey);
    }

    public async Task<JiraSeenDto> StartAsync(JiraStartRequest request)
    {
        var key = NormalizeKey(request.JiraKey);
        var title = CleanTitle(request.Title, key);
        var focus = await _focus.GetAsync();

        if (focus.Active && (request.FinishPrevious || request.MarkPreviousDone))
        {
            await _focus.FinishAsync(new FocusActionRequest
            {
                DurationMinutes = request.DurationMinutes ?? 10,
                Source = "Extension",
                MarkTaskDone = request.MarkPreviousDone
            });
        }

        var energy = string.IsNullOrWhiteSpace(request.EnergyType) ? EnergyTypes.Deep : request.EnergyType.Trim();
        if (!EnergyTypes.All.Contains(energy))
        {
            energy = EnergyTypes.Deep;
        }

        var match = await _links.GetByKeyAsync(key);
        TaskDto task;
        if (match is null)
        {
            var storedTitle = title.Contains(key, StringComparison.OrdinalIgnoreCase)
                ? title
                : title.Length > key.Length
                    ? title
                    : $"{key} {title}";
            var sameDay = await _tasks.FindSameTitleTodayAsync(storedTitle);
            if (sameDay is not null)
            {
                task = sameDay;
            }
            else
            {
                task = await _tasks.CreateTaskAsync(new CreateTaskRequest
                {
                    Title = storedTitle,
                    EnergyType = energy,
                    TagList = ["jira"]
                });
            }

            await _links.UpsertAsync(task.Id, key, request.JiraUrl, 1, TaskMapping.Now());
        }
        else
        {
            task = await _tasks.GetAsync(match.TaskId) ?? throw new InvalidOperationException("Task not found.");
            if (IsJunkTitle(task.Title, key) && !IsJunkTitle(title, key))
            {
                await _tasks.UpdateAsync(task.Id, new UpdateTaskRequest
                {
                    Title = title,
                    Status = task.Status,
                    EnergyType = task.EnergyType,
                    TagList = task.Tags,
                    Ownership = task.Ownership
                });
                task = await _tasks.GetAsync(task.Id) ?? task;
            }
            if (string.Equals(task.Status, TaskStatuses.Done, StringComparison.OrdinalIgnoreCase))
            {
                await _tasks.UpdateStatusAsync(task.Id, new UpdateTaskStatusRequest { Status = TaskStatuses.Doing });
                task = await _tasks.GetAsync(task.Id) ?? task;
            }
            if (!string.Equals(task.EnergyType, energy, StringComparison.OrdinalIgnoreCase))
            {
                await _tasks.UpdateAsync(task.Id, new UpdateTaskRequest
                {
                    Title = task.Title,
                    Status = task.Status,
                    EnergyType = energy,
                    TagList = task.Tags
                });
                task = await _tasks.GetAsync(task.Id) ?? task;
            }
            await _links.UpsertAsync(task.Id, key, request.JiraUrl ?? match.JiraUrl, match.OpenCount + 1, TaskMapping.Now());
        }

        await _focus.SetAsync(new SetFocusRequest
        {
            Description = task.Title,
            TaskId = task.Id,
            DurationMinutes = request.DurationMinutes ?? 10,
            Source = "Extension",
            Log = true
        });

        var started = await _links.GetByKeyAsync(key);
        var nowFocus = await _focus.GetAsync();
        return Result(key, request.JiraUrl, task.Title, "continue", started, nowFocus, key);
    }

    private static JiraSeenDto Result(
        string key,
        string? url,
        string title,
        string decision,
        TaskJiraRow? match,
        WorkFocusDto focus,
        string? focusKey) => new()
    {
        JiraKey = key,
        JiraUrl = url,
        Title = title,
        Decision = decision,
        OpenCount = match?.OpenCount ?? 0,
        MatchedTask = match is null ? null : new JiraTaskRefDto
        {
            Id = match.TaskId,
            Title = match.Title,
            Status = match.Status,
            OpenCount = match.OpenCount
        },
        CurrentFocus = new JiraFocusRefDto
        {
            Active = focus.Active,
            Description = focus.Description,
            TaskId = focus.TaskId,
            JiraKey = focusKey
        }
    };

    private static string NormalizeKey(string? raw, string? url = null)
    {
        var key = (raw ?? string.Empty).Trim().ToUpperInvariant();
        if (KeyPattern.IsMatch(key))
        {
            return key;
        }

        var fromUrl = ExtractKeyFromText(url) ?? ExtractKeyFromText(raw);
        if (fromUrl is not null)
        {
            return fromUrl;
        }

        throw new ArgumentException("jiraKey must look like PROJ-123.");
    }

    private static string CleanTitle(string? raw, string key)
    {
        var title = string.IsNullOrWhiteSpace(raw) ? key : raw.Trim();
        return IsJunkTitle(title, key) ? key : title;
    }

    private static bool IsJunkTitle(string? title, string key)
    {
        var text = (title ?? string.Empty).Trim();
        if (text.Length == 0 || text.Equals(key, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (text.Contains("jira.smartx.ir", StringComparison.OrdinalIgnoreCase)
            || text.Contains("://", StringComparison.OrdinalIgnoreCase)
            || text.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return text.Equals("Service Management", StringComparison.OrdinalIgnoreCase)
            || text.Equals("Product Support", StringComparison.OrdinalIgnoreCase);
    }

    private static string? ExtractKeyFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var matches = KeyInText.Matches(text);
        return matches.Count == 0 ? null : matches[^1].Value.ToUpperInvariant();
    }
}

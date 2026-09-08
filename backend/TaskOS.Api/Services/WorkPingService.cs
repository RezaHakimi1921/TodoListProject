using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public sealed class WorkPingService : IWorkPingService
{
    private static readonly TimeSpan JiraDwell = TimeSpan.FromSeconds(30);
    private static readonly object JiraWatchLock = new();
    private static string? _jiraWatchKey;
    private static DateTime _jiraWatchSince;
    private static string? _jiraPromptedKey;
    private static int _open;
    private readonly ISettingsService _settings;
    private readonly IFocusService _focus;
    private readonly ITaskService _tasks;
    private readonly IProblemService _problems;
    private readonly IWorkLogService _workLogs;
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WorkPingService> _logger;

    public WorkPingService(
        ISettingsService settings,
        IFocusService focus,
        ITaskService tasks,
        IProblemService problems,
        IWorkLogService workLogs,
        IServiceScopeFactory scopes,
        IConfiguration configuration,
        ILogger<WorkPingService> logger)
    {
        _settings = settings;
        _focus = focus;
        _tasks = tasks;
        _problems = problems;
        _workLogs = workLogs;
        _scopes = scopes;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> TryNotifyAsync(bool force, CancellationToken cancellationToken = default)
    {
        var settings = await _settings.GetAsync();
        if (settings.Paused || await _settings.IsRestingAsync())
        {
            return false;
        }

        if (!force && !IsDue(settings))
        {
            return false;
        }

        if (Interlocked.CompareExchange(ref _open, 1, 0) != 0) return false;

        try
        {
            await _settings.MarkPingAsync();
            var focus = await _focus.GetAsync();
            var heading = focus.Active ? "هنوز همین کار؟" : "الان روی کدام مورد وقت گذاشتی؟";
            var body = focus.Active && !string.IsNullOrWhiteSpace(focus.Description)
                ? focus.Description
                : $"{settings.PingMinutes} دقیقه گذشت.";
            var items = await LoadPicksAsync(focus);

            WorkPingResult result;
            try
            {
                result = WorkPingForm.ShowCentered(heading, body, settings.PingMinutes, items, CreateTaskSync, CreateProblemSync);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Center form failed; falling back to toast");
                try { WindowsToast.Show("TaskOS", body); }
                catch (Exception toastEx) { _logger.LogWarning(toastEx, "Windows toast failed"); return false; }
                return true;
            }

            if (result.Choice == WorkPingChoice.Dismissed)
            {
                _logger.LogInformation("Work ping dismissed without logging");
                return true;
            }

            try
            {
                await ApplyAsync(result, settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Work ping apply failed for {Choice} / {Title}", result.Choice, result.Work?.Title);
                throw;
            }

            _logger.LogInformation("Work ping closed with {Choice}", result.Choice);
            return true;
        }
        finally
        {
            Interlocked.Exchange(ref _open, 0);
        }
    }

    public void QueueJiraPrompt(JiraSeenDto seen)
    {
        if (string.IsNullOrWhiteSpace(seen.JiraKey))
        {
            return;
        }

        if (string.Equals(seen.Decision, "continue", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var key = seen.JiraKey;
        var now = DateTime.UtcNow;
        var startTimer = false;
        lock (JiraWatchLock)
        {
            if (!string.Equals(_jiraWatchKey, key, StringComparison.OrdinalIgnoreCase))
            {
                _jiraWatchKey = key;
                _jiraWatchSince = now;
                _jiraPromptedKey = null;
                startTimer = true;
                _logger.LogInformation("Jira switch dwell started for {Key}", key);
            }
            else if (now - _jiraWatchSince < JiraDwell
                     || string.Equals(_jiraPromptedKey, key, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
            else
            {
                _jiraPromptedKey = key;
            }
        }

        if (startTimer)
        {
            _ = Task.Run(async () =>
            {
                await Task.Delay(JiraDwell);
                lock (JiraWatchLock)
                {
                    if (!string.Equals(_jiraWatchKey, key, StringComparison.OrdinalIgnoreCase)
                        || string.Equals(_jiraPromptedKey, key, StringComparison.OrdinalIgnoreCase)
                        || DateTime.UtcNow - _jiraWatchSince < JiraDwell)
                    {
                        return;
                    }

                    _jiraPromptedKey = key;
                }

                ShowJiraPrompt(seen);
            });
            return;
        }

        ShowJiraPrompt(seen);
    }

    private void ShowJiraPrompt(JiraSeenDto seen)
    {
        var factory = _scopes;
        var logger = _logger;
        _ = Task.Run(() =>
        {
            if (Interlocked.CompareExchange(ref _open, 1, 0) != 0)
            {
                logger.LogInformation("Jira form skipped; another TaskOS form is already open");
                return;
            }

            try
            {
                using var scope = factory.CreateScope();
                var ping = (WorkPingService)scope.ServiceProvider.GetRequiredService<IWorkPingService>();
                ping.ShowJiraForm(seen);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Jira Windows form failed");
            }
            finally
            {
                Interlocked.Exchange(ref _open, 0);
            }
        });
    }

    private void ShowJiraForm(JiraSeenDto seen)
    {
        using var scope = _scopes.CreateScope();
        var settings = scope.ServiceProvider.GetRequiredService<ISettingsService>().GetAsync().GetAwaiter().GetResult();
        var focus = seen.CurrentFocus;
        var isNewLink = focus?.Active == true
            && !string.Equals(focus.JiraKey, seen.JiraKey, StringComparison.OrdinalIgnoreCase);
        var heading = isNewLink
            ? "لینک جدید باز شد"
            : seen.Decision switch
            {
                "ask-create" => "تکت جدید Jira",
                "ask-start" => "شروع تکت Jira",
                "continue" => "تکت Jira در آدرس",
                _ => "کار قبلی تمام شد؟"
            };
        var ticketTitle = string.IsNullOrWhiteSpace(seen.Title) || seen.Title == seen.JiraKey
            ? seen.JiraKey
            : seen.Title;

        if (isNewLink)
        {
            var choice = SwitchAskForm.ShowCentered(focus!.Description ?? "", ticketTitle);
            if (choice == SwitchAskChoice.JustChecking || choice == SwitchAskChoice.Dismissed)
            {
                return;
            }

            if (choice == SwitchAskChoice.Rest)
            {
                ApplyAsync(new WorkPingResult
                {
                    Choice = WorkPingChoice.Break,
                    Minutes = Math.Max(1, settings.PingMinutes),
                    Work = new WorkPickItem { Kind = "break", Title = "استراحت" }
                }, settings).GetAwaiter().GetResult();
                return;
            }

            using var startScope = _scopes.CreateScope();
            var jira = startScope.ServiceProvider.GetRequiredService<IJiraLinkService>();
            jira.StartAsync(new JiraStartRequest
            {
                JiraKey = seen.JiraKey,
                JiraUrl = seen.JiraUrl,
                Title = ticketTitle,
                FinishPrevious = true,
                DurationMinutes = settings.PingMinutes
            }).GetAwaiter().GetResult();
            return;
        }

        var body = focus?.Active == true
            ? $"الان: {focus.Description}{Environment.NewLine}تکت: {ticketTitle}"
            : $"تکت: {ticketTitle}";

        var items = LoadPicksAsync(new WorkFocusDto
        {
            Active = focus?.Active ?? false,
            Description = focus?.Description ?? "",
            TaskId = focus?.TaskId
        }).GetAwaiter().GetResult();

        if (isNewLink)
        {
            foreach (var item in items.Where(row => row.Kind == "current").ToList())
            {
                items.Remove(item);
                items.Insert(0, new WorkPickItem
                {
                    Kind = item.Kind,
                    Id = item.Id,
                    Title = item.Title,
                    Meta = "ادامه کار قبلی"
                });
            }
        }

        items.Insert(0, new WorkPickItem
        {
            Kind = "jira",
            Title = ticketTitle,
            Meta = isNewLink ? "ادامه با کار جدید" : "شروع این تکت",
            JiraKey = seen.JiraKey,
            JiraUrl = seen.JiraUrl,
            Id = seen.MatchedTask?.Id
        });

        var result = WorkPingForm.ShowCentered(heading, body, settings.PingMinutes, items, CreateTaskSync, CreateProblemSync);
        if (result.Choice == WorkPingChoice.Dismissed)
        {
            return;
        }

        ApplyAsync(result, settings).GetAwaiter().GetResult();
    }

    private WorkPickItem? CreateTaskSync(string title, string energy)
    {
        using var scope = _scopes.CreateScope();
        var tasks = scope.ServiceProvider.GetRequiredService<ITaskService>();
        var energyType = string.Equals(energy, "Deep", StringComparison.OrdinalIgnoreCase) ? "Deep" : "Light";
        var created = tasks.CreateTaskAsync(new CreateTaskRequest { Title = title, EnergyType = energyType }).GetAwaiter().GetResult();
        return new WorkPickItem
        {
            Kind = "task",
            Id = created.Id,
            Title = created.Title,
            Meta = energyType == "Deep" ? "تمرکز عمیق" : "کار عادی"
        };
    }

    private WorkPickItem? CreateProblemSync(string title)
    {
        using var scope = _scopes.CreateScope();
        var problems = scope.ServiceProvider.GetRequiredService<IProblemService>();
        var created = problems.CreateAsync(new CreateProblemRequest { Title = title }).GetAwaiter().GetResult();
        return new WorkPickItem { Kind = "problem", Id = created.Id, Title = created.Title, Meta = "در حال کشف" };
    }

    private async Task<List<WorkPickItem>> LoadPicksAsync(WorkFocusDto focus)
    {
        var items = new List<WorkPickItem>();
        if (focus.Active && !string.IsNullOrWhiteSpace(focus.Description))
        {
            items.Add(new WorkPickItem
            {
                Kind = "current",
                Id = focus.TaskId ?? focus.ProblemId,
                Title = focus.Description,
                Meta = "ادامه بده"
            });
        }

        var tasks = await _tasks.ListAsync(null, null, null);
        foreach (var task in tasks.Where(row => !string.Equals(row.Status, "Done", StringComparison.OrdinalIgnoreCase)))
        {
            items.Add(new WorkPickItem { Kind = "task", Id = task.Id, Title = task.Title, Meta = StatusFa(task.Status) });
        }

        foreach (var problem in await _problems.ListAsync())
        {
            items.Add(new WorkPickItem { Kind = "problem", Id = problem.Id, Title = problem.Title, Meta = ProblemFa(problem.Status) });
        }

        items.Add(new WorkPickItem { Kind = "break", Title = "استراحت", Meta = "غیرکار" });
        items.Add(new WorkPickItem { Kind = "break", Title = "چای / قهوه", Meta = "غیرکار" });
        items.Add(new WorkPickItem { Kind = "break", Title = "ناهار / غذا", Meta = "غیرکار" });
        items.Add(new WorkPickItem { Kind = "break", Title = "انتظار / وقفه", Meta = "غیرکار" });
        return items;
    }

    private async Task ApplyAsync(WorkPingResult result, AppSettingsDto settings)
    {
        switch (result.Choice)
        {
            case WorkPingChoice.Submit when result.Work is { } work && result.Minutes > 0:
                if (work.Kind == "jira" && !string.IsNullOrWhiteSpace(work.JiraKey))
                {
                    using var scope = _scopes.CreateScope();
                    var jira = scope.ServiceProvider.GetRequiredService<IJiraLinkService>();
                    await jira.StartAsync(new JiraStartRequest
                    {
                        JiraKey = work.JiraKey,
                        JiraUrl = work.JiraUrl,
                        Title = work.Title,
                        FinishPrevious = true,
                        DurationMinutes = result.Minutes,
                        EnergyType = result.EnergyType
                    });
                    break;
                }

                if (work.Kind == "current")
                {
                    await _focus.TickAsync(new FocusActionRequest { DurationMinutes = result.Minutes, Source = "Timer" });
                    await ApplyEnergyAsync(work.Id, result.EnergyType);
                    break;
                }

                await _focus.SetAsync(new SetFocusRequest
                {
                    Description = work.Title,
                    TaskId = work.Kind == "task" ? work.Id : null,
                    ProblemId = work.Kind == "problem" ? work.Id : null,
                    DurationMinutes = result.Minutes,
                    Source = "Timer",
                    Log = true
                });
                if (work.Kind == "task")
                {
                    await ApplyEnergyAsync(work.Id, result.EnergyType);
                }
                break;
            case WorkPingChoice.Break when result.Work is { } rest && result.Minutes > 0:
                await _workLogs.CaptureAsync(new CaptureWorkLogRequest
                {
                    Description = rest.Title,
                    DurationMinutes = result.Minutes,
                    Source = "Break"
                });
                break;
            case WorkPingChoice.Pause:
                await _settings.UpdateAsync(new AppSettingsDto { PingMinutes = settings.PingMinutes, Paused = true });
                break;
        }
    }

    private async Task ApplyEnergyAsync(int? taskId, string? energy)
    {
        if (taskId is not int id || string.IsNullOrWhiteSpace(energy))
        {
            return;
        }

        var energyType = string.Equals(energy, "Deep", StringComparison.OrdinalIgnoreCase) ? "Deep" : "Light";
        var task = await _tasks.GetAsync(id);
        if (task is null || string.Equals(task.EnergyType, energyType, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await _tasks.UpdateAsync(id, new UpdateTaskRequest
        {
            Title = task.Title,
            Status = task.Status,
            EnergyType = energyType,
            TagList = task.Tags
        });
    }

    private static string StatusFa(string status) => status switch
    {
        "Doing" => "در حال انجام",
        "Stuck" => "گیر کرده",
        "Open" => "باز",
        _ => status
    };

    private static string ProblemFa(string status) => status switch
    {
        "Exploring" => "در حال کشف",
        "Chosen" => "انتخاب شده",
        "Validated" => "تست شد",
        _ => status
    };

    private static bool IsDue(AppSettingsDto settings)
    {
        if (!DateTime.TryParse(settings.LastPingAt, out var last)) return false;
        var lastUtc = last.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(last, DateTimeKind.Utc)
            : last.ToUniversalTime();
        return DateTime.UtcNow - lastUtc >= TimeSpan.FromMinutes(Math.Max(1, settings.PingMinutes));
    }
}

using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public sealed class WorkPingService : IWorkPingService
{
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
        if (!force)
        {
            if (settings.Paused) return false;
            if (!IsDue(settings)) return false;
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
            var url = _configuration["TaskOS:FrontendUrl"] ?? "http://127.0.0.1:5173";
            var items = await LoadPicksAsync(focus);

            WorkPingResult result;
            try
            {
                result = WorkPingForm.ShowCentered(heading, body, settings.PingMinutes, items, CreateTaskSync, CreateProblemSync);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Center form failed; falling back to toast");
                try { WindowsToast.Show("TaskOS", body, url); }
                catch (Exception toastEx) { _logger.LogWarning(toastEx, "Windows toast failed"); return false; }
                return true;
            }

            if (result.Choice == WorkPingChoice.Dismissed)
            {
                _logger.LogInformation("Work ping dismissed without logging");
                return true;
            }

            await ApplyAsync(result, settings);
            _logger.LogInformation("Work ping closed with {Choice}", result.Choice);
            return true;
        }
        finally
        {
            Interlocked.Exchange(ref _open, 0);
        }
    }

    private WorkPickItem? CreateTaskSync(string title)
    {
        using var scope = _scopes.CreateScope();
        var tasks = scope.ServiceProvider.GetRequiredService<ITaskService>();
        var created = tasks.CreateTaskAsync(new CreateTaskRequest { Title = title, EnergyType = "Light" }).GetAwaiter().GetResult();
        return new WorkPickItem { Kind = "task", Id = created.Id, Title = created.Title, Meta = "باز" };
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
                if (work.Kind == "current")
                {
                    await _focus.TickAsync(new FocusActionRequest { DurationMinutes = result.Minutes, Source = "Timer" });
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

using System.Text.RegularExpressions;
using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public sealed class JiraWatchService : IJiraWatchService
{
    public static readonly TimeSpan Dwell = TimeSpan.FromSeconds(30);
    private static readonly Regex KeyPattern = new(@"^[A-Z][A-Z0-9]+-\d+$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    private readonly object _gate = new();
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<JiraWatchService> _logger;
    private WatchState? _watch;

    public JiraWatchService(IServiceScopeFactory scopes, ILogger<JiraWatchService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    public Task HeartbeatAsync(JiraWatchRequest request, CancellationToken cancellationToken = default)
    {
        var key = NormalizeKey(request.JiraKey);
        if (key is null)
        {
            return Task.CompletedTask;
        }

        var title = string.IsNullOrWhiteSpace(request.Title) ? key : request.Title.Trim();
        var now = DateTime.UtcNow;

        lock (_gate)
        {
            if (_watch is { } current && string.Equals(current.Key, key, StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(title) && !string.Equals(title, key, StringComparison.OrdinalIgnoreCase))
                {
                    current.Title = title;
                }

                if (!string.IsNullOrWhiteSpace(request.JiraUrl))
                {
                    current.Url = request.JiraUrl;
                }

                current.LastSeenUtc = now;
                if (current.Dismissed)
                {
                    return Task.CompletedTask;
                }

                if (current.Transferred)
                {
                    return TryTransferAsync(cancellationToken);
                }
            }
            else
            {
                _watch = new WatchState
                {
                    Key = key,
                    Title = title,
                    Url = request.JiraUrl,
                    // شمارش از همین لحظه شروع می‌شود. زمان قدیمی افزونه باعث می‌شد
                    // جابه‌جایی همان لحظه انجام شود و بنر هیچ‌وقت مقصد را نشان ندهد.
                    SinceUtc = now,
                    LastSeenUtc = now
                };
                _logger.LogInformation("Jira dwell started for {Key}", key);
            }
        }

        return TryTransferAsync(cancellationToken);
    }

    public void Clear(string? jiraKey = null)
    {
        lock (_gate)
        {
            if (_watch is null)
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(jiraKey)
                && !string.Equals(_watch.Key, jiraKey, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            _watch = null;
        }
    }

    public void DismissPending()
    {
        lock (_gate)
        {
            if (_watch is null)
            {
                return;
            }

            _watch.Dismissed = true;
        }
    }

    public async Task<JiraSwitchPendingDto?> GetPendingAsync(CancellationToken cancellationToken = default)
    {
        await TryTransferAsync(cancellationToken);
        WatchState? snapshot;
        lock (_gate)
        {
            snapshot = _watch is null || _watch.Transferred || _watch.Dismissed ? null : _watch.Clone();
        }

        if (snapshot is null)
        {
            return null;
        }

        using var scope = _scopes.CreateScope();
        var focus = await scope.ServiceProvider.GetRequiredService<IFocusService>().GetAsync();
        var match = await scope.ServiceProvider.GetRequiredService<TaskOS.Api.Repositories.ITaskJiraRepository>().GetByKeyAsync(snapshot.Key);

        if (focus.Active && match is not null && focus.TaskId == match.TaskId)
        {
            MarkTransferred(snapshot.Key);
            return null;
        }

        var remaining = RemainingSeconds(snapshot.SinceUtc);
        var title = match is not null && !IsBareTitle(match.Title, snapshot.Key)
            ? match.Title!
            : snapshot.Title;
        title = await ResolveBannerTitleAsync(snapshot.Key, title, cancellationToken);
        return new JiraSwitchPendingDto
        {
            JiraKey = snapshot.Key,
            Title = title,
            RemainingSeconds = remaining <= 0 ? 1 : remaining,
            SinceUnixMs = ToUnixMs(snapshot.SinceUtc),
            TaskId = match?.TaskId
        };
    }

    public Task TryTransferAsync(CancellationToken cancellationToken = default) =>
        TransferSnapshotAsync(requireElapsed: true, ignoreRest: false, allowCreate: false, cancellationToken);

    public Task TransferNowAsync(CancellationToken cancellationToken = default) =>
        TransferSnapshotAsync(requireElapsed: false, ignoreRest: true, allowCreate: true, cancellationToken);

    private async Task TransferSnapshotAsync(bool requireElapsed, bool ignoreRest, bool allowCreate, CancellationToken cancellationToken)
    {
        WatchState? snapshot;
        lock (_gate)
        {
            snapshot = _watch is null || _watch.Transferred || _watch.Dismissed ? null : _watch.Clone();
        }

        if (snapshot is null || (requireElapsed && RemainingSeconds(snapshot.SinceUtc) > 0))
        {
            return;
        }

        try
        {
            using var scope = _scopes.CreateScope();
            var settings = scope.ServiceProvider.GetRequiredService<ISettingsService>();
            var focus = scope.ServiceProvider.GetRequiredService<IFocusService>();
            if (await settings.IsRestingAsync())
            {
                if (!ignoreRest)
                {
                    return;
                }

                await focus.EndRestAsync();
            }

            var current = await focus.GetAsync();
            var links = scope.ServiceProvider.GetRequiredService<Repositories.ITaskJiraRepository>();
            var match = await links.GetByKeyAsync(snapshot.Key);
            if (current.Active && match is not null && current.TaskId == match.TaskId)
            {
                MarkTransferred(snapshot.Key);
                return;
            }

            var pingMinutes = (await settings.GetAsync()).PingMinutes;
            if (IsDismissed(snapshot.Key))
            {
                return;
            }

            // Glancing at an open ticket must not create a task. «منتقل بکن» does.
            // A Done/closed ticket the user opened should still start so they can log time.
            if (match is null && !allowCreate && !await IsClosedIssueAsync(scope, snapshot.Key, cancellationToken))
            {
                return;
            }

            var jira = scope.ServiceProvider.GetRequiredService<IJiraLinkService>();
            await jira.StartAsync(new JiraStartRequest
            {
                JiraKey = snapshot.Key,
                JiraUrl = snapshot.Url,
                Title = snapshot.Title,
                FinishPrevious = true,
                DurationMinutes = pingMinutes
            });
            MarkTransferred(snapshot.Key);
            _logger.LogInformation("Jira dwell transferred focus to {Key}", snapshot.Key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Jira dwell transfer failed for {Key}", snapshot.Key);
        }
    }

    private async Task<string> ResolveBannerTitleAsync(string key, string title, CancellationToken cancellationToken)
    {
        if (!IsBareTitle(title, key) || TitleAlreadyResolved(key))
        {
            return string.IsNullOrWhiteSpace(title) ? key : title;
        }

        string? summary = null;
        try
        {
            using var scope = _scopes.CreateScope();
            summary = await scope.ServiceProvider.GetRequiredService<IJiraRestClient>().GetSummaryAsync(key, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogDebug(ex, "Jira summary for banner {Key} failed", key);
        }

        var clean = string.IsNullOrWhiteSpace(summary) || IsBareTitle(summary, key) ? title : summary.Trim();
        if (string.IsNullOrWhiteSpace(clean))
        {
            clean = key;
        }

        lock (_gate)
        {
            if (_watch is not null && string.Equals(_watch.Key, key, StringComparison.OrdinalIgnoreCase))
            {
                _watch.Title = clean;
                _watch.TitleResolved = true;
            }
        }

        return clean;
    }

    private bool TitleAlreadyResolved(string key)
    {
        lock (_gate)
        {
            return _watch is not null
                && string.Equals(_watch.Key, key, StringComparison.OrdinalIgnoreCase)
                && _watch.TitleResolved;
        }
    }

    private static bool IsBareTitle(string? title, string key)
    {
        var text = (title ?? string.Empty).Trim();
        return text.Length == 0 || text.Equals(key, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<bool> IsClosedIssueAsync(IServiceScope scope, string key, CancellationToken cancellationToken)
    {
        try
        {
            var jiraRest = scope.ServiceProvider.GetRequiredService<IJiraRestClient>();
            var states = await jiraRest.SearchIssueStatesAsync([key], cancellationToken);
            var state = states.FirstOrDefault(row => row.Key.Equals(key, StringComparison.OrdinalIgnoreCase));
            return state is not null && JiraRestClient.IsClosedStatus(state.Status);
        }
        catch (Exception)
        {
            return false;
        }
    }

    private bool IsDismissed(string key)
    {
        lock (_gate)
        {
            return _watch is not null
                && string.Equals(_watch.Key, key, StringComparison.OrdinalIgnoreCase)
                && _watch.Dismissed;
        }
    }

    private void MarkTransferred(string key)
    {
        lock (_gate)
        {
            if (_watch is not null
                && string.Equals(_watch.Key, key, StringComparison.OrdinalIgnoreCase)
                && !_watch.Dismissed)
            {
                _watch.Transferred = true;
            }
        }
    }

    private static int RemainingSeconds(DateTime sinceUtc)
    {
        var left = Dwell - (DateTime.UtcNow - sinceUtc);
        return left <= TimeSpan.Zero ? 0 : (int)Math.Ceiling(left.TotalSeconds);
    }

    private static long ToUnixMs(DateTime sinceUtc)
    {
        var utc = sinceUtc.Kind == DateTimeKind.Utc ? sinceUtc : DateTime.SpecifyKind(sinceUtc, DateTimeKind.Utc);
        return new DateTimeOffset(utc).ToUnixTimeMilliseconds();
    }

    private static string? NormalizeKey(string? raw)
    {
        var key = (raw ?? string.Empty).Trim().ToUpperInvariant();
        if (!KeyPattern.IsMatch(key) || !key.StartsWith("PS-", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return key;
    }

    private sealed class WatchState
    {
        public string Key { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Url { get; set; }
        public DateTime SinceUtc { get; set; }
        public DateTime LastSeenUtc { get; set; }
        public bool Transferred { get; set; }
        public bool Dismissed { get; set; }
        public bool TitleResolved { get; set; }

        public WatchState Clone() => new()
        {
            Key = Key,
            Title = Title,
            Url = Url,
            SinceUtc = SinceUtc,
            LastSeenUtc = LastSeenUtc,
            Transferred = Transferred,
            Dismissed = Dismissed,
            TitleResolved = TitleResolved
        };
    }
}

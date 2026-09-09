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
        var incomingSince = request.SinceUnixMs > 0
            ? DateTimeOffset.FromUnixTimeMilliseconds(request.SinceUnixMs).UtcDateTime
            : now;
        if (incomingSince > now)
        {
            incomingSince = now;
        }

        lock (_gate)
        {
            if (_watch is { } current && string.Equals(current.Key, key, StringComparison.OrdinalIgnoreCase))
            {
                if (current.Transferred)
                {
                    current.LastSeenUtc = now;
                    return TryTransferAsync(cancellationToken);
                }

                if (incomingSince < current.SinceUtc)
                {
                    current.SinceUtc = incomingSince;
                }

                if (!string.IsNullOrWhiteSpace(title) && !string.Equals(title, key, StringComparison.OrdinalIgnoreCase))
                {
                    current.Title = title;
                }

                if (!string.IsNullOrWhiteSpace(request.JiraUrl))
                {
                    current.Url = request.JiraUrl;
                }

                current.LastSeenUtc = now;
            }
            else
            {
                _watch = new WatchState
                {
                    Key = key,
                    Title = title,
                    Url = request.JiraUrl,
                    SinceUtc = incomingSince,
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

    public async Task<JiraSwitchPendingDto?> GetPendingAsync(CancellationToken cancellationToken = default)
    {
        await TryTransferAsync(cancellationToken);
        WatchState? snapshot;
        lock (_gate)
        {
            snapshot = _watch is null || _watch.Transferred ? null : _watch.Clone();
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
        var title = match is not null && !string.IsNullOrWhiteSpace(match.Title)
            ? match.Title
            : snapshot.Title;
        return new JiraSwitchPendingDto
        {
            JiraKey = snapshot.Key,
            Title = title,
            RemainingSeconds = remaining <= 0 ? 1 : remaining,
            SinceUnixMs = ToUnixMs(snapshot.SinceUtc),
            TaskId = match?.TaskId
        };
    }

    public async Task TryTransferAsync(CancellationToken cancellationToken = default)
    {
        WatchState? snapshot;
        lock (_gate)
        {
            snapshot = _watch is null || _watch.Transferred ? null : _watch.Clone();
        }

        if (snapshot is null || RemainingSeconds(snapshot.SinceUtc) > 0)
        {
            return;
        }

        try
        {
            using var scope = _scopes.CreateScope();
            var settings = await scope.ServiceProvider.GetRequiredService<ISettingsService>().GetAsync();
            if (await scope.ServiceProvider.GetRequiredService<ISettingsService>().IsRestingAsync())
            {
                return;
            }

            var focus = await scope.ServiceProvider.GetRequiredService<IFocusService>().GetAsync();
            var links = scope.ServiceProvider.GetRequiredService<Repositories.ITaskJiraRepository>();
            var match = await links.GetByKeyAsync(snapshot.Key);
            if (focus.Active && match is not null && focus.TaskId == match.TaskId)
            {
                MarkTransferred(snapshot.Key);
                return;
            }

            var jira = scope.ServiceProvider.GetRequiredService<IJiraLinkService>();
            await jira.StartAsync(new JiraStartRequest
            {
                JiraKey = snapshot.Key,
                JiraUrl = snapshot.Url,
                Title = snapshot.Title,
                FinishPrevious = true,
                DurationMinutes = settings.PingMinutes
            });
            MarkTransferred(snapshot.Key);
            _logger.LogInformation("Jira dwell transferred focus to {Key}", snapshot.Key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Jira dwell transfer failed for {Key}", snapshot.Key);
        }
    }

    private void MarkTransferred(string key)
    {
        lock (_gate)
        {
            if (_watch is not null && string.Equals(_watch.Key, key, StringComparison.OrdinalIgnoreCase))
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

        public WatchState Clone() => new()
        {
            Key = Key,
            Title = Title,
            Url = Url,
            SinceUtc = SinceUtc,
            LastSeenUtc = LastSeenUtc,
            Transferred = Transferred
        };
    }
}

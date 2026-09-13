using Dapper;
using TaskOS.Api.Data;

namespace TaskOS.Api.Services;

public sealed class WorkPingRelayHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IPushNotificationService _push;
    private readonly SqliteConnectionFactory _factory;
    private readonly ILogger<WorkPingRelayHostedService> _logger;

    public WorkPingRelayHostedService(
        IServiceScopeFactory scopes,
        IPushNotificationService push,
        SqliteConnectionFactory factory,
        ILogger<WorkPingRelayHostedService> logger)
    {
        _scopes = scopes;
        _push = push;
        _factory = factory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(20));
        try
        {
            await TickAsync(stoppingToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Work ping relay failed");
        }

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Work ping relay failed");
            }
        }
    }

    private async Task TickAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopes.CreateScope();
        var settings = await scope.ServiceProvider.GetRequiredService<ISettingsService>().GetAsync();
        if (settings.Paused || await scope.ServiceProvider.GetRequiredService<ISettingsService>().IsRestingAsync())
        {
            return;
        }

        var minutes = Math.Max(1, settings.PingMinutes);
        using var connection = _factory.Create();
        var sentRaw = await connection.ExecuteScalarAsync<string?>(
            "SELECT Value FROM AppSettings WHERE Key = 'PushLastWorkPingAt'");
        if (DateTime.TryParse(sentRaw, out var sentAt))
        {
            var sentUtc = sentAt.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(sentAt, DateTimeKind.Utc)
                : sentAt.ToUniversalTime();
            if (DateTime.UtcNow - sentUtc < TimeSpan.FromMinutes(minutes))
            {
                return;
            }
        }

        stoppingToken.ThrowIfCancellationRequested();
        await _push.SendAsync(
            "یادآوری تمرکز",
            $"{minutes} دقیقه گذشت. الان روی چه کاری هستی؟",
            "/");
        await connection.ExecuteAsync(
            """
            INSERT INTO AppSettings (Key, Value) VALUES ('PushLastWorkPingAt', @Value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
            """,
            new { Value = DateTime.UtcNow.ToString("o") });
    }
}

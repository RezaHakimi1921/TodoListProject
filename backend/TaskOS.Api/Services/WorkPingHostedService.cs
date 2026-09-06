namespace TaskOS.Api.Services;

public sealed class WorkPingHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<WorkPingHostedService> _logger;

    public WorkPingHostedService(IServiceScopeFactory scopes, ILogger<WorkPingHostedService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Work ping host started");
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var ping = scope.ServiceProvider.GetRequiredService<IWorkPingService>();
                await ping.TryNotifyAsync(force: false, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Work ping tick failed");
            }
        }
    }
}

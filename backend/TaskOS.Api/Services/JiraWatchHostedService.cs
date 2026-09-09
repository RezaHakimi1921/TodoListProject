namespace TaskOS.Api.Services;

public sealed class JiraWatchHostedService : BackgroundService
{
    private readonly IJiraWatchService _watch;

    public JiraWatchHostedService(IJiraWatchService watch)
    {
        _watch = watch;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await _watch.TryTransferAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch
            {
                // Next tick retries.
            }
        }
    }
}

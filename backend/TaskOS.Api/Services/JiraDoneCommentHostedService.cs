namespace TaskOS.Api.Services;

public sealed class JiraDoneCommentHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<JiraDoneCommentHostedService> _logger;

    public JiraDoneCommentHostedService(IServiceScopeFactory scopes, ILogger<JiraDoneCommentHostedService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Poll(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(20));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await Poll(stoppingToken);
        }
    }

    private async Task Poll(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            await scope.ServiceProvider.GetRequiredService<JiraDoneCommentService>().PollAsync(stoppingToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Done-comment sync failed");
        }
    }
}

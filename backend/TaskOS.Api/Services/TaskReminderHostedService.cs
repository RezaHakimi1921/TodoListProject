namespace TaskOS.Api.Services;

public sealed class TaskReminderHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<TaskReminderHostedService> _logger;

    public TaskReminderHostedService(IServiceScopeFactory scopes, ILogger<TaskReminderHostedService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Poll(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
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
            await scope.ServiceProvider.GetRequiredService<ITaskReminderService>().FireDueAsync(stoppingToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Task reminder fire failed");
        }
    }
}
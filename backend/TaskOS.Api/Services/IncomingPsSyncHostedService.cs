namespace TaskOS.Api.Services;

public sealed class IncomingPsSyncHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<IncomingPsSyncHostedService> _logger;

    public IncomingPsSyncHostedService(IServiceScopeFactory scopes, ILogger<IncomingPsSyncHostedService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await SyncOnce(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await SyncOnce(stoppingToken);
        }
    }

    private async Task SyncOnce(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var jiraRest = scope.ServiceProvider.GetRequiredService<IJiraRestClient>();
            var links = scope.ServiceProvider.GetRequiredService<IJiraLinkService>();
            var issues = await jiraRest.ListUnassignedProductSupportAsync(stoppingToken);
            foreach (var issue in issues)
            {
                await jiraRest.AssignToMeAsync(issue.Key, stoppingToken);
                await links.RegisterAsync(new Dtos.JiraStartRequest
                {
                    JiraKey = issue.Key,
                    Title = issue.Summary,
                    JiraUrl = $"https://jira.smartx.ir/browse/{issue.Key}",
                    EnergyType = "Deep"
                });
                _logger.LogInformation("Assigned and registered {Key}", issue.Key);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Incoming PS sync failed");
        }
    }
}

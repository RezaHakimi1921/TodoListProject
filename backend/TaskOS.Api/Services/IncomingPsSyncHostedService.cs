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
            var inbox = scope.ServiceProvider.GetRequiredService<IJiraCommentInboxService>();
            var repo = scope.ServiceProvider.GetRequiredService<Repositories.ITaskJiraRepository>();
            var recent = await jiraRest.ListRecentOpenProductSupportAsync(stoppingToken);
            var registered = 0;
            foreach (var issue in recent)
            {
                if (await repo.GetByKeyAsync(issue.Key) is not null)
                {
                    continue;
                }

                var assigned = await jiraRest.AssignToMeAsync(issue.Key, stoppingToken);
                await links.RegisterAsync(new Dtos.JiraStartRequest
                {
                    JiraKey = issue.Key,
                    Title = issue.Summary,
                    JiraUrl = $"https://jira.smartx.ir/browse/{issue.Key}",
                    EnergyType = "Deep"
                });
                registered++;
                _logger.LogInformation("Assigned={Assigned} and registered new {Key}", assigned, issue.Key);
            }

            var issues = await jiraRest.ListUnassignedProductSupportAsync(stoppingToken);
            foreach (var issue in issues)
            {
                if (await repo.GetByKeyAsync(issue.Key) is not null)
                {
                    continue;
                }

                await jiraRest.AssignToMeAsync(issue.Key, stoppingToken);
                await links.RegisterAsync(new Dtos.JiraStartRequest
                {
                    JiraKey = issue.Key,
                    Title = issue.Summary,
                    JiraUrl = $"https://jira.smartx.ir/browse/{issue.Key}",
                    EnergyType = "Deep"
                });
                registered++;
                _logger.LogInformation("Assigned and registered unassigned {Key}", issue.Key);
            }

            await inbox.SeedRecentNewTasksAsync();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Incoming PS sync failed");
        }
    }
}

using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

/// <summary>
/// After boot/Wi-Fi settle, refresh LAN phone URL and ntfy so the phone gets a tappable link.
/// </summary>
public sealed class StartupPhoneNotifyHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<StartupPhoneNotifyHostedService> _logger;

    public StartupPhoneNotifyHostedService(
        IServiceScopeFactory scopes,
        ILogger<StartupPhoneNotifyHostedService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(12), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        try
        {
            using var scope = _scopes.CreateScope();
            var push = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();
            var lan = PushNotificationService.DetectPreferredLanBaseUrl();
            if (!string.IsNullOrWhiteSpace(lan))
            {
                await push.SavePhoneNotifyAsync(new PhoneNotifyRequest { PhoneBaseUrl = lan });
            }

            var phone = await push.GetPhoneNotifyAsync();
            var url = string.IsNullOrWhiteSpace(phone.PhoneBaseUrl) ? lan : phone.PhoneBaseUrl;
            if (string.IsNullOrWhiteSpace(url)) return;

            await push.SendAsync(
                "TaskOS روشن شد",
                $"سیستم و برنامه بالا آمدند. روی گوشی باز کن: {url}",
                url);
            _logger.LogInformation("Startup phone notify sent for {Url}", url);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Startup phone notify failed");
        }
    }
}

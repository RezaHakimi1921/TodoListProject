using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IPushNotificationService
{
    Task<string> GetPublicKeyAsync();
    Task SubscribeAsync(string endpoint, string p256dh, string auth);
    Task UnsubscribeAsync(string endpoint);
    Task<int> SendAsync(string title, string body, string url);
    Task<int> SendToTopicAsync(string topic, string title, string body, string url);
    Task<PhoneNotifyDto> GetPhoneNotifyAsync();
    Task<PhoneNotifyDto> SavePhoneNotifyAsync(PhoneNotifyRequest? request);
}

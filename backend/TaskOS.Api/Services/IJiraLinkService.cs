using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IJiraLinkService
{
    Task<JiraSeenDto> SeenAsync(JiraSeenRequest request);
    Task<JiraSeenDto> StartAsync(JiraStartRequest request);
    Task<JiraSeenDto> RegisterAsync(JiraStartRequest request);
}

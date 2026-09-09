using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IJiraWatchService
{
    Task HeartbeatAsync(JiraWatchRequest request, CancellationToken cancellationToken = default);
    void Clear(string? jiraKey = null);
    Task<JiraSwitchPendingDto?> GetPendingAsync(CancellationToken cancellationToken = default);
    Task TryTransferAsync(CancellationToken cancellationToken = default);
}

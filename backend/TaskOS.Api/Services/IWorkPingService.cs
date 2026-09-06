using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IWorkPingService
{
    Task<bool> TryNotifyAsync(bool force, CancellationToken cancellationToken = default);
}

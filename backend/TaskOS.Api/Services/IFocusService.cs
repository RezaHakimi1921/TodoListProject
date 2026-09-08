using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IFocusService
{
    Task<WorkFocusDto> GetAsync();
    Task<WorkFocusDto> SetAsync(SetFocusRequest request);
    Task<WorkFocusDto> TickAsync(FocusActionRequest request);
    Task<WorkFocusDto> FinishAsync(FocusActionRequest request);
    Task<WorkFocusDto> ClearAsync();
    Task<WorkFocusDto> StartRestAsync(string? description = null);
    Task<WorkFocusDto> EndRestAsync();
}

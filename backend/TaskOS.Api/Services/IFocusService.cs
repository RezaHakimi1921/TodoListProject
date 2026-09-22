using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IFocusService
{
    Task<WorkFocusDto> GetAsync();
    Task<WorkFocusDto> SetAsync(SetFocusRequest request);
    Task<WorkFocusDto> TickAsync(FocusActionRequest request);
    Task<WorkFocusDto> FinishAsync(FocusActionRequest request);
    Task<WorkFocusDto> ClearAsync();
    Task<WorkFocusDto> ClearWithoutLogAsync();
    Task<WorkFocusDto> StartRestAsync(string? description = null, int? activityTaskId = null, string? note = null);
    Task<WorkFocusDto> SaveRestNoteAsync(string? note);
    Task<WorkFocusDto> EndRestAsync(string? note = null);
    Task FlushElapsedSliceAsync();
    Task FlushElapsedForTaskAsync(int taskId);
}

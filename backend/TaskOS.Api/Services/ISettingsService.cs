using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface ISettingsService
{
    Task<AppSettingsDto> GetAsync();
    Task<AppSettingsDto> UpdateAsync(AppSettingsDto request);
    Task<AppSettingsDto> MarkPingAsync();
    Task SetRestingAsync(bool resting);
    Task<bool> IsRestingAsync();
    Task SaveRestResumeAsync(int? taskId, int? problemId, string description);
    Task<(int? TaskId, int? ProblemId, string Description)> PeekRestResumeAsync();
    Task<(int? TaskId, int? ProblemId, string Description)> ConsumeRestResumeAsync();
}

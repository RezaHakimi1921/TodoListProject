using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface ISettingsService
{
    Task<AppSettingsDto> GetAsync();
    Task<AppSettingsDto> UpdateAsync(AppSettingsDto request);
    Task<AppSettingsDto> MarkPingAsync();
}

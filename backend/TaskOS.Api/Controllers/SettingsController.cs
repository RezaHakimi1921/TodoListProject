using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/settings")]
public sealed class SettingsController : ControllerBase
{
    private readonly ISettingsService _settings;
    private readonly IWorkPingService _ping;

    public SettingsController(ISettingsService settings, IWorkPingService ping)
    {
        _settings = settings;
        _ping = ping;
    }

    [HttpGet]
    public async Task<ActionResult<AppSettingsDto>> Get() => Ok(await _settings.GetAsync());

    [HttpPut]
    public async Task<ActionResult<AppSettingsDto>> Update([FromBody] AppSettingsDto request) =>
        Ok(await _settings.UpdateAsync(request ?? new AppSettingsDto()));

    [HttpPost("ack-ping")]
    public async Task<ActionResult<AppSettingsDto>> AckPing() => Ok(await _settings.MarkPingAsync());

    [HttpPost("test-toast")]
    public async Task<IActionResult> TestToast()
    {
        var shown = await _ping.TryNotifyAsync(force: true);
        return shown ? Ok(await _settings.GetAsync()) : StatusCode(500, new { error = "Toast failed" });
    }
}

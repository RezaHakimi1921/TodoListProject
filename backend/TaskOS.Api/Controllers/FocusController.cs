using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/focus")]
public sealed class FocusController : ControllerBase
{
    private readonly IFocusService _focus;
    private readonly IJiraWatchService _watch;

    public FocusController(IFocusService focus, IJiraWatchService watch)
    {
        _focus = focus;
        _watch = watch;
    }

    [HttpGet]
    public async Task<ActionResult<WorkFocusDto>> Get()
    {
        var pending = await _watch.GetPendingAsync();
        var focus = await _focus.GetAsync();
        focus.PendingSwitch = pending;
        return Ok(focus);
    }

    [HttpPut]
    public async Task<ActionResult<WorkFocusDto>> Set([FromBody] SetFocusRequest request)
    {
        try
        {
            return Ok(await _focus.SetAsync(request));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("tick")]
    public async Task<ActionResult<WorkFocusDto>> Tick([FromBody] FocusActionRequest? request)
    {
        try
        {
            return Ok(await _focus.TickAsync(request ?? new FocusActionRequest()));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("finish")]
    public async Task<ActionResult<WorkFocusDto>> Finish([FromBody] FocusActionRequest? request)
    {
        try
        {
            return Ok(await _focus.FinishAsync(request ?? new FocusActionRequest()));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete]
    public async Task<ActionResult<WorkFocusDto>> Clear() => Ok(await _focus.ClearAsync());

    [HttpPost("rest")]
    public async Task<ActionResult<WorkFocusDto>> StartRest([FromBody] StartRestRequest? request) =>
        Ok(await _focus.StartRestAsync(request?.Description));

    [HttpPost("rest/end")]
    public async Task<ActionResult<WorkFocusDto>> EndRest() => Ok(await _focus.EndRestAsync());
}

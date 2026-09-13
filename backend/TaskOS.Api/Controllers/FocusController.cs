using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/focus")]
public sealed class FocusController : ControllerBase
{
    private readonly IFocusService _focus;
    private readonly IJiraWatchService _watch;
    private readonly IJiraLinkService _jira;

    public FocusController(IFocusService focus, IJiraWatchService watch, IJiraLinkService jira)
    {
        _focus = focus;
        _watch = watch;
        _jira = jira;
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
    public async Task<ActionResult<WorkFocusDto>> StartRest([FromBody] StartRestRequest? request)
    {
        var description = request?.Description;
        int? activityTaskId = null;
        if (ActivityJira.TryGetKey(description, out var key))
        {
            var registered = await _jira.RegisterAsync(new JiraStartRequest
            {
                JiraKey = key,
                Title = description?.Trim(),
                JiraUrl = ActivityJira.BrowseUrl(key),
                EnergyType = EnergyTypes.Light
            });
            activityTaskId = registered.MatchedTask?.Id;
        }

        return Ok(await _focus.StartRestAsync(description, activityTaskId, request?.Note));
    }

    [HttpPost("rest/note")]
    public async Task<ActionResult<WorkFocusDto>> SaveRestNote([FromBody] StartRestRequest? request) =>
        Ok(await _focus.SaveRestNoteAsync(request?.Note));

    [HttpPost("rest/end")]
    public async Task<ActionResult<WorkFocusDto>> EndRest([FromBody] StartRestRequest? request) =>
        Ok(await _focus.EndRestAsync(request?.Note));

    [HttpPost("transfer")]
    public async Task<ActionResult<WorkFocusDto>> Transfer()
    {
        await _watch.TransferNowAsync();
        var pending = await _watch.GetPendingAsync();
        var focus = await _focus.GetAsync();
        focus.PendingSwitch = pending;
        return Ok(focus);
    }

    [HttpPost("hold")]
    public async Task<ActionResult<WorkFocusDto>> Hold()
    {
        _watch.DismissPending();
        var pending = await _watch.GetPendingAsync();
        var focus = await _focus.GetAsync();
        focus.PendingSwitch = pending;
        return Ok(focus);
    }
}

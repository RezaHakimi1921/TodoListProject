using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/jira")]
public sealed class JiraController : ControllerBase
{
    private readonly IJiraLinkService _jira;
    private readonly IJiraRestClient _jiraRest;
    private readonly IJiraWatchService _watch;
    private readonly IWorkPingService _ping;

    public JiraController(IJiraLinkService jira, IJiraRestClient jiraRest, IJiraWatchService watch, IWorkPingService ping)
    {
        _jira = jira;
        _jiraRest = jiraRest;
        _watch = watch;
        _ping = ping;
    }

    [HttpPost("seen")]
    public async Task<IActionResult> Seen([FromBody] JiraSeenRequest request)
    {
        try
        {
            var seen = await _jira.SeenAsync(request ?? new JiraSeenRequest());
            _ping.QueueJiraPrompt(seen);
            return Ok(seen);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("watch")]
    public async Task<IActionResult> Watch([FromBody] JiraWatchRequest? request, CancellationToken cancellationToken)
    {
        await _watch.HeartbeatAsync(request ?? new JiraWatchRequest(), cancellationToken);
        return Ok(new { ok = true, pending = await _watch.GetPendingAsync(cancellationToken) });
    }

    [HttpDelete("watch")]
    public IActionResult ClearWatch([FromQuery] string? key)
    {
        _watch.Clear(key);
        return Ok(new { ok = true });
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] JiraStartRequest request)
    {
        try
        {
            return Ok(await _jira.StartAsync(request ?? new JiraStartRequest()));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("import")]
    public async Task<IActionResult> Import([FromBody] JiraStartRequest request)
    {
        try
        {
            request ??= new JiraStartRequest();
            var assigned = await _jiraRest.AssignToMeAsync(request.JiraKey);
            var registered = await _jira.RegisterAsync(request);
            return Ok(new { assigned, registered });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("issues/{key}/comments")]
    public async Task<IActionResult> AddComment(string key, [FromBody] AddJiraCommentRequest? request, CancellationToken cancellationToken)
    {
        try
        {
            await _jiraRest.AddIssueCommentAsync(key, request?.Body ?? string.Empty, cancellationToken);
            return Ok(new { ok = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (JiraRestException)
        {
            return StatusCode(502, new { error = "ثبت کامنت در جیرا انجام نشد" });
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { error = "ثبت کامنت در جیرا انجام نشد" });
        }
    }
}

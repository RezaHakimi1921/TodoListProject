using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/jira")]
public sealed class JiraController : ControllerBase
{
    private readonly IJiraLinkService _jira;
    private readonly IWorkPingService _ping;

    public JiraController(IJiraLinkService jira, IWorkPingService ping)
    {
        _jira = jira;
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
}

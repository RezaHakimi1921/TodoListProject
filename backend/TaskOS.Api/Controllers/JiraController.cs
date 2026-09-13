using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
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
    private readonly JiraDoneCommentService _doneSync;

    public JiraController(IJiraLinkService jira, IJiraRestClient jiraRest, IJiraWatchService watch, IWorkPingService ping, JiraDoneCommentService doneSync)
    {
        _jira = jira;
        _jiraRest = jiraRest;
        _watch = watch;
        _ping = ping;
        _doneSync = doneSync;
    }

    [HttpGet("projects")]
    public IActionResult Projects()
    {
        return Ok(new[] { new { key = "SIP", name = "SIP" } });
    }

    [HttpGet("create-meta")]
    public async Task<IActionResult> CreateMeta(CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _jiraRest.GetSipCreateMetaAsync(cancellationToken));
        }
        catch (JiraRestException)
        {
            return StatusCode(502, new { error = "خواندن فیلدهای جیرا انجام نشد" });
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { error = "خواندن فیلدهای جیرا انجام نشد" });
        }
    }

    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] JiraCreateTaskRequest? request, CancellationToken cancellationToken)
    {
        try
        {
            request ??= new JiraCreateTaskRequest();
            var title = request.Title.Trim();
            if (title.Length == 0)
            {
                return BadRequest(new { error = "عنوان لازم است" });
            }

            var assignee = string.IsNullOrWhiteSpace(request.AssigneeName) ? "reza" : request.AssigneeName.Trim();
            var ownership = TaskOwnerships.Normalize(
                !string.IsNullOrWhiteSpace(request.Ownership)
                    ? request.Ownership
                    : JiraRestClient.IsSelf(assignee) ? TaskOwnerships.Mine : TaskOwnerships.Other);

            var created = await _jiraRest.CreateSipIssueAsync(
                title,
                request.Description,
                request.IssueTypeId,
                request.IssueTypeName,
                request.ComponentId,
                assignee,
                cancellationToken);

            var registered = await _jira.RegisterAsync(new JiraStartRequest
            {
                JiraKey = created.Key,
                JiraUrl = created.BrowseUrl,
                Title = created.Summary,
                EnergyType = request.EnergyType,
                Ownership = ownership
            });

            return Ok(new
            {
                created = new { key = created.Key, browseUrl = created.BrowseUrl, summary = created.Summary },
                registered
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (JiraRestException ex)
        {
            return StatusCode(502, new { error = FormatJiraError(ex) });
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { error = "ساخت تیکت در جیرا انجام نشد" });
        }
    }

    private static string FormatJiraError(JiraRestException ex)
    {
        try
        {
            using var doc = JsonDocument.Parse(ex.ResponseBody);
            var parts = new List<string>();
            if (doc.RootElement.TryGetProperty("errorMessages", out var messages) && messages.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in messages.EnumerateArray())
                {
                    var text = item.GetString();
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        parts.Add(text);
                    }
                }
            }

            if (doc.RootElement.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Object)
            {
                foreach (var item in errors.EnumerateObject())
                {
                    var text = item.Value.GetString();
                    parts.Add(string.IsNullOrWhiteSpace(text) ? item.Name : text);
                }
            }

            if (parts.Count > 0)
            {
                return string.Join(" — ", parts);
            }
        }
        catch
        {
            // keep fallback
        }

        return "ساخت تیکت در جیرا انجام نشد";
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

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] JiraStartRequest request)
    {
        try
        {
            return Ok(await _jira.RegisterAsync(request ?? new JiraStartRequest()));
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

    [HttpPost("issues/{key}/sync-closed")]
    public async Task<IActionResult> SyncClosed(string key, CancellationToken cancellationToken)
    {
        var closed = await _doneSync.TryCloseFromJiraAsync(key, cancellationToken);
        return Ok(new { closed });
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

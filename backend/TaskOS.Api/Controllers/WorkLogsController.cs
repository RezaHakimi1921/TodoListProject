using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/worklogs")]
public sealed class WorkLogsController : ControllerBase
{
    private readonly IWorkLogService _workLogs;
    private readonly ITrashService _trash;

    public WorkLogsController(IWorkLogService workLogs, ITrashService trash)
    {
        _workLogs = workLogs;
        _trash = trash;
    }

    [HttpPost]
    public async Task<ActionResult<WorkLogDto>> Capture([FromBody] CaptureWorkLogRequest request)
    {
        try
        {
            var created = await _workLogs.CaptureAsync(request);
            return Created($"/api/worklogs/{created.Id}", created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkLogDto>>> List([FromQuery] string? date)
    {
        try
        {
            return Ok(await _workLogs.ListByDateAsync(date ?? DateTime.Now.ToString("yyyy-MM-dd")));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("summary")]
    public async Task<ActionResult<WorkLogSummaryDto>> Summary([FromQuery] string? date)
    {
        try
        {
            return Ok(await _workLogs.GetSummaryAsync(date ?? DateTime.Now.ToString("yyyy-MM-dd")));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("by-task/{taskId:int}")]
    public async Task<ActionResult<EntityWorkLogDto>> ByTask(int taskId) =>
        Ok(await _workLogs.ListByTaskAsync(taskId));

    [HttpGet("by-problem/{problemId:int}")]
    public async Task<ActionResult<EntityWorkLogDto>> ByProblem(int problemId) =>
        Ok(await _workLogs.ListByProblemAsync(problemId));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            await _trash.SoftDeleteAsync(TrashKinds.WorkLog, id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

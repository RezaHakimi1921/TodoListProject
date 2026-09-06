using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/dailylogs")]
public sealed class DailyLogsController : ControllerBase
{
    private readonly IDailyLogService _logs;
    private readonly ITrashService _trash;

    public DailyLogsController(IDailyLogService logs, ITrashService trash)
    {
        _logs = logs;
        _trash = trash;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? date)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(date))
            {
                return Ok(await _logs.ListAsync());
            }

            var log = await _logs.GetByDateAsync(date);
            return log is null ? Ok(null) : Ok(log);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<DailyLogDto>> Upsert([FromBody] UpsertDailyLogRequest request)
    {
        try
        {
            return Ok(await _logs.UpsertAsync(request));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            await _trash.SoftDeleteAsync(TrashKinds.DailyLog, id);
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

    [HttpGet("{date}/related-tasks")]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> RelatedTasks(string date)
    {
        try
        {
            return Ok(await _logs.GetRelatedTasksAsync(date));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class RemindersController : ControllerBase
{
    private readonly ITaskReminderService _reminders;
    private readonly ITaskService _tasks;

    public RemindersController(ITaskReminderService reminders, ITaskService tasks)
    {
        _reminders = reminders;
        _tasks = tasks;
    }

    [HttpGet("tasks/{taskId:int}/reminders")]
    public async Task<ActionResult<IReadOnlyList<TaskReminderDto>>> List(int taskId)
    {
        var task = await _tasks.GetAsync(taskId);
        if (task is null) return NotFound();
        return Ok(await _reminders.ListByTaskAsync(taskId));
    }

    [HttpPost("tasks/{taskId:int}/reminders")]
    public async Task<ActionResult<TaskReminderDto>> Create(int taskId, [FromBody] CreateTaskReminderRequest? request)
    {
        try
        {
            var created = await _reminders.CreateAsync(taskId, request ?? new CreateTaskReminderRequest());
            return created is null ? NotFound() : Ok(created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }


    [HttpGet("reminders")]
    public async Task<ActionResult<IReadOnlyList<TaskReminderDto>>> ListPending() =>
        Ok(await _reminders.ListPendingAsync());

    [HttpGet("reminders/fired")]
    public async Task<ActionResult<IReadOnlyList<TaskReminderDto>>> ListFired([FromQuery] int limit = 50) =>
        Ok(await _reminders.ListFiredAsync(limit));

    [HttpPut("reminders/{id:int}")]
    public async Task<ActionResult<TaskReminderDto>> Update(int id, [FromBody] CreateTaskReminderRequest? request)
    {
        try
        {
            var updated = await _reminders.UpdateAsync(id, request ?? new CreateTaskReminderRequest());
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("reminders/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _reminders.DeleteAsync(id);
        return ok ? Ok(new { ok = true }) : NotFound();
    }
}
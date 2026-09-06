using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/tasks")]
public sealed class TasksController : ControllerBase
{
    private readonly ITaskService _tasks;
    private readonly ITaskChecklistService _checklist;
    private readonly ITrashService _trash;

    public TasksController(ITaskService tasks, ITaskChecklistService checklist, ITrashService trash)
    {
        _tasks = tasks;
        _checklist = checklist;
        _trash = trash;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> List(
        [FromQuery] string? status,
        [FromQuery] string? energyType,
        [FromQuery] string? tag,
        [FromQuery] string? date,
        [FromQuery] string? q)
    {
        return Ok(await _tasks.ListAsync(status, energyType, tag, date, q));
    }

    [HttpGet("similar")]
    public async Task<ActionResult<IReadOnlyList<SimilarTaskDto>>> Similar([FromQuery] string? title)
    {
        return Ok(await _tasks.GetSimilarTasksAsync(title ?? string.Empty));
    }

    [HttpGet("days")]
    public async Task<ActionResult<IReadOnlyList<TaskDayDto>>> Days() =>
        Ok(await _tasks.ListDaysAsync());

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TaskDto>> Get(int id)
    {
        var task = await _tasks.GetAsync(id);
        return task is null ? NotFound() : Ok(task);
    }

    [HttpPost]
    public async Task<ActionResult<TaskDto>> Create([FromBody] CreateTaskRequest request)
    {
        try
        {
            var created = await _tasks.CreateTaskAsync(request ?? new CreateTaskRequest());
            return Ok(created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<TaskDto>> Update(int id, [FromBody] UpdateTaskRequest request)
    {
        try
        {
            var updated = await _tasks.UpdateAsync(id, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        return await _tasks.DeleteAsync(id) ? NoContent() : NotFound();
    }

    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<TaskDto>> UpdateStatus(int id, [FromBody] UpdateTaskStatusRequest request)
    {
        try
        {
            var updated = await _tasks.UpdateStatusAsync(id, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id:int}/timeline")]
    public async Task<ActionResult<IReadOnlyList<TimelineEntryDto>>> Timeline(int id)
    {
        if (await _tasks.GetAsync(id) is null)
        {
            return NotFound();
        }

        return Ok(await _tasks.ListTimelineAsync(id));
    }

    [HttpPost("{id:int}/timeline")]
    public async Task<ActionResult<TimelineEntryDto>> AddTimeline(int id, [FromBody] AddTimelineRequest request)
    {
        try
        {
            var entry = await _tasks.AddTimelineAsync(id, request.Note);
            return entry is null ? NotFound() : Ok(entry);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}/timeline/{entryId:int}")]
    public async Task<IActionResult> DeleteTimeline(int id, int entryId)
    {
        if (await _tasks.GetAsync(id) is null)
        {
            return NotFound();
        }

        var entries = await _tasks.ListTimelineAsync(id);
        if (entries.All(item => item.Id != entryId))
        {
            return NotFound();
        }

        try
        {
            await _trash.SoftDeleteAsync(TrashKinds.Timeline, entryId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("{taskId:int}/checklist")]
    public async Task<IActionResult> ListChecklist(int taskId)
    {
        try
        {
            return Ok(await _checklist.ListAsync(taskId));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{taskId:int}/checklist")]
    public async Task<IActionResult> AddChecklist(int taskId, [FromBody] CreateChecklistItemRequest request)
    {
        try
        {
            return Ok(await _checklist.AddAsync(taskId, request ?? new CreateChecklistItemRequest()));
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

    [HttpPut("{taskId:int}/checklist/{itemId:int}")]
    public async Task<IActionResult> UpdateChecklist(int taskId, int itemId, [FromBody] UpdateChecklistItemRequest request)
    {
        try
        {
            var updated = await _checklist.UpdateAsync(taskId, itemId, request ?? new UpdateChecklistItemRequest());
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{taskId:int}/checklist/{itemId:int}")]
    public async Task<IActionResult> DeleteChecklist(int taskId, int itemId)
    {
        return await _checklist.DeleteAsync(taskId, itemId) ? NoContent() : NotFound();
    }
}

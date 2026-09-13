using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/problems")]
public sealed class ProblemsController : ControllerBase
{
    private readonly IProblemService _problems;
    private readonly ITrashService _trash;

    public ProblemsController(IProblemService problems, ITrashService trash)
    {
        _problems = problems;
        _trash = trash;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProblemDto>>> List() =>
        Ok(await _problems.ListAsync());

    [HttpPost]
    public async Task<ActionResult<ProblemDto>> Create([FromBody] CreateProblemRequest request)
    {
        try
        {
            var created = await _problems.CreateAsync(request ?? new CreateProblemRequest());
            return Ok(created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProblemDto>> Get(int id)
    {
        var problem = await _problems.GetAsync(id);
        return problem is null ? NotFound() : Ok(problem);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ProblemDto>> Update(int id, [FromBody] UpdateProblemRequest request)
    {
        try
        {
            var updated = await _problems.UpdateAsync(id, request);
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
        try
        {
            await _trash.SoftDeleteAsync(TrashKinds.Problem, id);
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

    [HttpPost("{id:int}/options")]
    public async Task<ActionResult<ProblemDto>> AddOption(int id, [FromBody] UpsertOptionRequest request)
    {
        try
        {
            var updated = await _problems.AddOptionAsync(id, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}/options/{optionId:int}")]
    public async Task<ActionResult<ProblemDto>> UpdateOption(int id, int optionId, [FromBody] UpsertOptionRequest request)
    {
        try
        {
            var updated = await _problems.UpdateOptionAsync(id, optionId, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}/options/{optionId:int}")]
    public async Task<ActionResult<ProblemDto>> DeleteOption(int id, int optionId)
    {
        try
        {
            var updated = await _problems.DeleteOptionAsync(id, optionId);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{id:int}/choose")]
    public async Task<ActionResult<ProblemDto>> Choose(int id, [FromBody] ChooseOptionRequest request)
    {
        try
        {
            var updated = await _problems.ChooseAsync(id, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:int}/validate")]
    public async Task<ActionResult<ProblemDto>> Validate(int id, [FromBody] ValidateProblemRequest request)
    {
        try
        {
            var updated = await _problems.ValidateAsync(id, request);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:int}/actions")]
    public async Task<ActionResult<ProblemDto>> AddAction(int id, [FromBody] UpsertProblemActionRequest request)
    {
        try
        {
            var updated = await _problems.AddActionAsync(id, request ?? new UpsertProblemActionRequest());
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}/actions/{actionId:int}")]
    public async Task<ActionResult<ProblemDto>> UpdateAction(int id, int actionId, [FromBody] UpsertProblemActionRequest request)
    {
        try
        {
            var updated = await _problems.UpdateActionAsync(id, actionId, request ?? new UpsertProblemActionRequest());
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}/actions/{actionId:int}")]
    public async Task<ActionResult<ProblemDto>> DeleteAction(int id, int actionId)
    {
        var updated = await _problems.DeleteActionAsync(id, actionId);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpGet("{id:int}/tasks")]
    public async Task<ActionResult<ProblemDto>> ListTasks(int id)
    {
        var problem = await _problems.GetAsync(id);
        return problem is null ? NotFound() : Ok(problem);
    }

    [HttpPost("{id:int}/tasks")]
    public async Task<ActionResult<ProblemDto>> AttachTask(int id, [FromBody] AttachTaskRequest request)
    {
        try
        {
            var ids = new List<int>();
            if (request?.TaskId > 0) ids.Add(request.TaskId);
            if (request?.TaskIds is { Count: > 0 } extra) ids.AddRange(extra);
            var updated = await _problems.AttachTasksAsync(id, ids);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}/tasks/{taskId:int}")]
    public async Task<ActionResult<ProblemDto>> DetachTask(int id, int taskId)
    {
        var updated = await _problems.DetachTaskAsync(id, taskId);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpGet("by-task/{taskId:int}")]
    public async Task<ActionResult<IReadOnlyList<ProblemLinkDto>>> ListByTask(int taskId) =>
        Ok(await _problems.ListByTaskAsync(taskId));
}

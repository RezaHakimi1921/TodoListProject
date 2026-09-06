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
}

using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/trash")]
public sealed class TrashController : ControllerBase
{
    private readonly ITrashService _trash;

    public TrashController(ITrashService trash)
    {
        _trash = trash;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TrashItemDto>>> List() =>
        Ok(await _trash.ListAsync());

    [HttpPost]
    public async Task<IActionResult> SoftDelete([FromBody] TrashActionRequest request)
    {
        try
        {
            await _trash.SoftDeleteAsync(request.Kind, request.Id);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    [HttpPost("restore")]
    public async Task<IActionResult> Restore([FromBody] TrashActionRequest request)
    {
        try
        {
            await _trash.RestoreAsync(request.Kind, request.Id);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpDelete]
    public async Task<IActionResult> Purge([FromQuery] string? kind, [FromQuery] int? id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(kind) && id is null)
            {
                await _trash.EmptyAsync();
                return NoContent();
            }

            if (string.IsNullOrWhiteSpace(kind) || id is null)
            {
                return BadRequest(new { error = "kind and id are required, or omit both to empty trash." });
            }

            await _trash.PurgeAsync(kind, id.Value);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
}

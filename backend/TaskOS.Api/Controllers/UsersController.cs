using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UsersController : ControllerBase
{
    private readonly IAuthService _auth;

    public UsersController(IAuthService auth) => _auth = auth;

    private async Task<IActionResult?> RequireAdminAsync()
    {
        var acting = _auth.CurrentUsername(User);
        if (!await _auth.IsAdminAsync(acting))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "فقط ادمین به مدیریت کاربران دسترسی دارد." });
        }
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        if (await RequireAdminAsync() is { } denied) return denied;
        return Ok(await _auth.ListUsersAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest? request)
    {
        if (await RequireAdminAsync() is { } denied) return denied;
        try
        {
            var created = await _auth.CreateUserAsync(request ?? new CreateUserRequest());
            return Ok(created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest? request)
    {
        if (await RequireAdminAsync() is { } denied) return denied;
        try
        {
            var updated = await _auth.UpdateUserAsync(id, request ?? new UpdateUserRequest());
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (await RequireAdminAsync() is { } denied) return denied;
        try
        {
            var acting = _auth.CurrentUsername(User) ?? string.Empty;
            var ok = await _auth.DeleteUserAsync(id, acting);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

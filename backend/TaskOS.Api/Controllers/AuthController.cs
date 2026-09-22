using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly IFocusService _focus;

    public AuthController(IAuthService auth, IFocusService focus)
    {
        _auth = auth;
        _focus = focus;
    }

    [AllowAnonymous]
    [HttpGet("providers")]
    public async Task<ActionResult<AuthProvidersDto>> Providers() => Ok(await _auth.GetProvidersAsync());

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest? request)
    {
        request ??= new LoginRequest();
        if (!await _auth.ValidateAsync(request.Username, request.Password))
        {
            return Unauthorized(new { error = "نام کاربری یا رمز عبور اشتباه است" });
        }

        await _auth.SignInAsync(HttpContext, request.Username.Trim());
        var me = await _auth.GetByUsernameAsync(request.Username.Trim());
        return Ok(ToMeDto(me, request.Username.Trim()));
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest? request)
    {
        try
        {
            await _auth.ForgotPasswordAsync(request?.Email ?? request?.UsernameOrEmail ?? string.Empty);
            return Ok(new { ok = true, message = "اگر حسابی با این ایمیل باشد، کد عددی موقت به ntfy همان کاربر ارسال شد." });
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

    [AllowAnonymous]
    [HttpPost("reset-password-with-temp")]
    public async Task<IActionResult> ResetPasswordWithTemp([FromBody] ResetPasswordWithTempRequest? request)
    {
        try
        {
            request ??= new ResetPasswordWithTempRequest();
            await _auth.ResetPasswordWithTempAsync(
                request.Email ?? string.Empty,
                request.TempPassword ?? string.Empty,
                request.NewPassword ?? string.Empty);
            return Ok(new { ok = true, message = "رمز جدید ذخیره شد. حالا با رمز جدید وارد شو." });
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

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest? request)
    {
        var name = _auth.CurrentUsername(User);
        if (string.IsNullOrWhiteSpace(name))
            return Unauthorized(new { error = "وارد نشده‌ای" });
        try
        {
            request ??= new ChangePasswordRequest();
            await _auth.ChangePasswordAsync(name, request.CurrentPassword, request.NewPassword ?? string.Empty);
            await _auth.SignInAsync(HttpContext, name);
            var me = await _auth.GetByUsernameAsync(name);
            return Ok(ToMeDto(me, name));
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

    [Authorize]
    [HttpPut("me/ntfy-topic")]
    public async Task<IActionResult> UpdateMyNtfyTopic([FromBody] UpdateMyNtfyTopicRequest? request)
    {
        var name = _auth.CurrentUsername(User);
        if (string.IsNullOrWhiteSpace(name))
            return Unauthorized(new { error = "وارد نشده‌ای" });
        try
        {
            var topic = await _auth.UpdateMyNtfyTopicAsync(name, request?.NtfyTopic);
            return Ok(new { ntfyTopic = topic, ntfyUrl = "https://ntfy.sh/" + topic });
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

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        try { await _focus.ClearAsync(); } catch { }
        await _auth.SignOutAsync(HttpContext);
        return Ok(new { ok = true });
    }

    [AllowAnonymous]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var name = _auth.CurrentUsername(User);
        var mode = User.FindFirstValue("auth_mode");
        var isLoopback = string.Equals(mode, "loopback", StringComparison.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(name) || isLoopback)
        {
            return Ok(new AuthMeDto { Authenticated = false });
        }

        var me = await _auth.GetByUsernameAsync(name);
        return Ok(ToMeDto(me, name));
    }

    private static AuthMeDto ToMeDto(AppUserDto? me, string fallbackUsername) => new()
    {
        Authenticated = true,
        Username = me?.Username ?? fallbackUsername,
        DisplayName = me is null ? null : $"{me.FirstName} {me.LastName}".Trim(),
        Email = me?.Email,
        Role = me?.Role ?? "User",
        IsAdmin = string.Equals(me?.Role, "Admin", StringComparison.OrdinalIgnoreCase),
        MustChangePassword = me?.MustChangePassword == true,
        NtfyTopic = me?.NtfyTopic,
    };
}
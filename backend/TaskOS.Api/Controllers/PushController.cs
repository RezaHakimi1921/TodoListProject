using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/push")]
public sealed class PushController : ControllerBase
{
    private readonly IPushNotificationService _push;

    public PushController(IPushNotificationService push)
    {
        _push = push;
    }

    [HttpGet("vapid")]
    public async Task<ActionResult<PushPublicKeyDto>> Vapid() =>
        Ok(new PushPublicKeyDto { PublicKey = await _push.GetPublicKeyAsync() });

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscribeRequest? request)
    {
        try
        {
            var p256dh = request?.P256dh ?? request?.Keys?.P256dh ?? "";
            var auth = request?.Auth ?? request?.Keys?.Auth ?? "";
            await _push.SubscribeAsync(request?.Endpoint ?? "", p256dh, auth);
            return Ok(new { ok = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("subscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] PushSubscribeRequest? request)
    {
        await _push.UnsubscribeAsync(request?.Endpoint ?? "");
        return Ok(new { ok = true });
    }

    [HttpGet("phone")]
    public async Task<ActionResult<PhoneNotifyDto>> Phone() =>
        Ok(await _push.GetPhoneNotifyAsync());

    [HttpPut("phone")]
    public async Task<ActionResult<PhoneNotifyDto>> SavePhone([FromBody] PhoneNotifyRequest? request) =>
        Ok(await _push.SavePhoneNotifyAsync(request));

    [HttpPost("test")]
    public async Task<IActionResult> Test([FromBody] PushTestRequest? request)
    {
        var sent = await _push.SendAsync(
            request?.Title ?? "TaskOS",
            request?.Body ?? "اگر این را دیدی، اعلان TaskOS روشن است.",
            "/notifications");
        return Ok(new { ok = true, sent });
    }
}

using Microsoft.AspNetCore.Mvc;
using TaskOS.Api.Dtos;
using TaskOS.Api.Services;

namespace TaskOS.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public sealed class NotificationsController : ControllerBase
{
    private readonly IJiraCommentInboxService _inbox;

    public NotificationsController(IJiraCommentInboxService inbox)
    {
        _inbox = inbox;
    }

    [HttpGet]
    public async Task<ActionResult<NotificationSummaryDto>> List([FromQuery] bool unread = false) =>
        Ok(await _inbox.ListAsync(unread));

    [HttpGet("unread-count")]
    public async Task<ActionResult<object>> UnreadCount() =>
        Ok(new { count = await _inbox.CountUnreadAsync() });

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        await _inbox.MarkReadAsync(id);
        return Ok(new { ok = true });
    }

    [HttpPost("read-task/{taskId:int}")]
    public async Task<IActionResult> MarkReadByTask(int taskId)
    {
        await _inbox.MarkReadByTaskAsync(taskId);
        return Ok(new { ok = true });
    }
}

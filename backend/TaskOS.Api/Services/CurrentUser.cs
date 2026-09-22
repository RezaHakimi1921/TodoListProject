using System.Security.Claims;

namespace TaskOS.Api.Services;

public interface ICurrentUser
{
    /// <summary>Stable owner key from auth (lowercase username).</summary>
    string UserId { get; }

    /// <summary>Non-empty owner for HTTP-scoped writes; empty in background jobs without ambient user.</summary>
    string RequireUserId();
}

public sealed class CurrentUser : ICurrentUser
{
    private static readonly AsyncLocal<string?> AmbientUserId = new();
    private readonly IHttpContextAccessor _http;

    public CurrentUser(IHttpContextAccessor http)
    {
        _http = http;
    }

    public string UserId
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(AmbientUserId.Value))
            {
                return AmbientUserId.Value!.Trim().ToLowerInvariant();
            }

            var user = _http.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true) return string.Empty;
            return user.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? user.Identity?.Name?.Trim().ToLowerInvariant()
                ?? string.Empty;
        }
    }

    public string RequireUserId()
    {
        var id = UserId;
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new InvalidOperationException("کاربر وارد نشده است.");
        }

        return id;
    }

    public static IDisposable Use(string userId)
    {
        var previous = AmbientUserId.Value;
        AmbientUserId.Value = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim().ToLowerInvariant();
        return new Restore(previous);
    }

    private sealed class Restore : IDisposable
    {
        private readonly string? _previous;
        private bool _done;

        public Restore(string? previous) => _previous = previous;

        public void Dispose()
        {
            if (_done) return;
            _done = true;
            AmbientUserId.Value = _previous;
        }
    }
}

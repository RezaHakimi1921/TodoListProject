using System.Net.Http.Json;
using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

/// <summary>
/// When the laptop API is the interactive UI, also push focus mutations to the
/// shared server so dashboards stay aligned.
/// </summary>
public interface IFocusMirror
{
    Task MirrorSetAsync(SetFocusRequest request);
    Task MirrorClearWithoutLogAsync();
    Task MirrorFinishAsync(FocusActionRequest request);
    Task MirrorClearAsync();
}

public sealed class FocusMirror : IFocusMirror
{
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly ILogger<FocusMirror> _logger;

    public FocusMirror(IHttpClientFactory http, IConfiguration config, ILogger<FocusMirror> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    private string? BaseUrl
    {
        get
        {
#if TASKOS_SERVER
            return null;
#else
            var raw = _config["TaskOS:FocusMirrorUrl"];
            return string.IsNullOrWhiteSpace(raw) ? null : raw.Trim().TrimEnd('/');
#endif
        }
    }

    public Task MirrorSetAsync(SetFocusRequest request) =>
        SendAsync(HttpMethod.Put, "/api/focus", request);

    public Task MirrorClearWithoutLogAsync() =>
        SendAsync(HttpMethod.Post, "/api/focus/clear-silent", null);

    public Task MirrorFinishAsync(FocusActionRequest request) =>
        SendAsync(HttpMethod.Post, "/api/focus/finish", request ?? new FocusActionRequest());

    public Task MirrorClearAsync() =>
        SendAsync(HttpMethod.Delete, "/api/focus", null);

    private async Task SendAsync(HttpMethod method, string path, object? body)
    {
        var root = BaseUrl;
        if (string.IsNullOrWhiteSpace(root)) return;
        try
        {
            using var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(4);
            using var req = new HttpRequestMessage(method, root + path);
            req.Headers.TryAddWithoutValidation("X-TaskOS-Extension", "1");
            if (body is not null)
            {
                req.Content = JsonContent.Create(body);
            }

            using var response = await client.SendAsync(req);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogDebug("Focus mirror {Path} -> {Status}", path, (int)response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Focus mirror {Path} failed", path);
        }
    }
}

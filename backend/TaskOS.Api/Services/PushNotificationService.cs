using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;
using WebPush;

namespace TaskOS.Api.Services;

public sealed class PushNotificationService : IPushNotificationService
{
    private static readonly Regex TopicPattern = new("^[A-Za-z0-9_-]{4,64}$", RegexOptions.CultureInvariant);
    private readonly SqliteConnectionFactory _factory;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<PushNotificationService> _logger;
    private readonly WebPushClient _client = new();

    public PushNotificationService(
        SqliteConnectionFactory factory,
        IHttpClientFactory httpFactory,
        ILogger<PushNotificationService> logger)
    {
        _factory = factory;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public async Task<string> GetPublicKeyAsync()
    {
        var keys = await EnsureKeysAsync();
        return keys.PublicKey;
    }

    public async Task SubscribeAsync(string endpoint, string p256dh, string auth)
    {
        if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(p256dh) || string.IsNullOrWhiteSpace(auth))
        {
            throw new ArgumentException("Push subscription is incomplete.");
        }

        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            """
            INSERT INTO PushSubscription (Endpoint, P256dh, Auth, CreatedAt)
            VALUES (@Endpoint, @P256dh, @Auth, @CreatedAt)
            ON CONFLICT(Endpoint) DO UPDATE SET P256dh = excluded.P256dh, Auth = excluded.Auth
            """,
            new { Endpoint = endpoint.Trim(), P256dh = p256dh.Trim(), Auth = auth.Trim(), CreatedAt = TaskMapping.Now() });
    }

    public async Task UnsubscribeAsync(string endpoint)
    {
        if (string.IsNullOrWhiteSpace(endpoint)) return;
        using var connection = _factory.Create();
        await connection.ExecuteAsync("DELETE FROM PushSubscription WHERE Endpoint = @Endpoint", new { Endpoint = endpoint.Trim() });
    }

    public async Task<PhoneNotifyDto> GetPhoneNotifyAsync()
    {
        var topic = await EnsureNtfyTopicAsync();
        return ToPhoneDto(topic, await ResolvePhoneBaseUrlAsync());
    }

    public async Task<PhoneNotifyDto> SavePhoneNotifyAsync(PhoneNotifyRequest? request)
    {
        var topic = NormalizeTopic(request?.NtfyTopic);
        if (topic.Length == 0)
        {
            topic = await EnsureNtfyTopicAsync();
        }
        else
        {
            await WriteSettingAsync("NtfyTopic", topic);
        }

        var baseUrl = NormalizeBaseUrl(request?.PhoneBaseUrl);
        if (baseUrl.Length > 0)
        {
            await WriteSettingAsync("PhoneBaseUrl", baseUrl);
        }

        return ToPhoneDto(topic, await ResolvePhoneBaseUrlAsync());
    }

    public async Task<int> SendToTopicAsync(string topic, string title, string body, string url)
    {
        var clean = NormalizeTopic(topic);
        if (clean.Length == 0) return 0;
        try
        {
            var heading = string.IsNullOrWhiteSpace(title) ? "TaskOS" : title.Trim();
            var text = string.IsNullOrWhiteSpace(body) ? "یک اعلان جدید" : body.Trim();
            if (text.Length > 400) text = text[..400] + "…";
            var click = await AbsolutePhoneUrlAsync(url);
            var payload = JsonSerializer.Serialize(new
            {
                topic = clean,
                title = heading,
                message = text,
                priority = 4,
                tags = new[] { "iphone" },
                click,
                actions = string.IsNullOrWhiteSpace(click)
                    ? null
                    : new[] { new { action = "view", label = "TaskOS", url = click, clear = true } },
            }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull });
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://ntfy.sh");
            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var client = _httpFactory.CreateClient();
            using var response = await client.SendAsync(request);
            return response.IsSuccessStatusCode ? 1 : 0;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ntfy topic send failed");
            return 0;
        }
    }
    public async Task<int> SendAsync(string title, string body, string url)
    {
        try
        {
            WindowsToast.Show(title, body, url);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Windows toast failed");
        }

        var ntfySent = await SendNtfyAsync(title, body, url);
        var keys = await EnsureKeysAsync();
        using var connection = _factory.Create();
        var rows = (await connection.QueryAsync<PushRow>("SELECT Endpoint, P256dh, Auth FROM PushSubscription")).ToList();
        if (rows.Count == 0) return ntfySent;

        var payload = JsonSerializer.Serialize(new
        {
            title = string.IsNullOrWhiteSpace(title) ? "TaskOS" : title.Trim(),
            body = (body ?? string.Empty).Trim(),
            url = string.IsNullOrWhiteSpace(url) ? "/" : url
        });
        var vapid = new VapidDetails("mailto:taskos@local", keys.PublicKey, keys.PrivateKey);

        foreach (var row in rows)
        {
            try
            {
                await _client.SendNotificationAsync(
                    new PushSubscription(row.Endpoint, row.P256dh, row.Auth),
                    payload,
                    vapid);
            }
            catch (WebPushException ex) when ((int)ex.StatusCode is 404 or 410)
            {
                await connection.ExecuteAsync("DELETE FROM PushSubscription WHERE Endpoint = @Endpoint", new { row.Endpoint });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Web push failed for {Endpoint}", row.Endpoint);
            }
        }

        return rows.Count + ntfySent;
    }

    private async Task<int> SendNtfyAsync(string title, string body, string url)
    {
        var topic = await ReadSettingAsync("NtfyTopic");
        if (string.IsNullOrWhiteSpace(topic) || !TopicPattern.IsMatch(topic)) return 0;
        try
        {
            var heading = string.IsNullOrWhiteSpace(title) ? "TaskOS" : title.Trim();
            var text = string.IsNullOrWhiteSpace(body) ? "یک اعلان جدید" : body.Trim();
            if (text.Length > 400) text = text[..400] + "…";
            var click = await AbsolutePhoneUrlAsync(url);
            var payload = JsonSerializer.Serialize(new
            {
                topic,
                title = heading,
                message = text,
                priority = 4,
                tags = new[] { "iphone" },
                click,
                actions = string.IsNullOrWhiteSpace(click)
                    ? null
                    : new[] { new { action = "view", label = "TaskOS", url = click, clear = true } },
            }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull });
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://ntfy.sh");
            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var client = _httpFactory.CreateClient();
            using var response = await client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("ntfy returned {Status}: {Error}", (int)response.StatusCode, error);
                return 0;
            }

            return 1;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ntfy send failed");
            return 0;
        }
    }

    private async Task<string> EnsureNtfyTopicAsync()
    {
        var existing = NormalizeTopic(await ReadSettingAsync("NtfyTopic"));
        if (existing.Length > 0) return existing;
        var generated = "taskos-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(5)).ToLowerInvariant();
        await WriteSettingAsync("NtfyTopic", generated);
        return generated;
    }

    private async Task<string?> ReadSettingAsync(string key)
    {
        using var connection = _factory.Create();
        return await connection.ExecuteScalarAsync<string?>("SELECT Value FROM AppSettings WHERE Key = @Key", new { Key = key });
    }

    private async Task WriteSettingAsync(string key, string value)
    {
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            """
            INSERT INTO AppSettings (Key, Value) VALUES (@Key, @Value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
            """,
            new { Key = key, Value = value });
    }

    private static string NormalizeTopic(string? topic)
    {
        var clean = (topic ?? string.Empty).Trim();
        return TopicPattern.IsMatch(clean) ? clean : string.Empty;
    }

    private async Task<string> ResolvePhoneBaseUrlAsync()
    {
        var saved = NormalizeBaseUrl(await ReadSettingAsync("PhoneBaseUrl"));
        return saved.Length > 0 ? saved : DetectLanBaseUrl();
    }

    private async Task<string?> AbsolutePhoneUrlAsync(string? path)
    {
        var root = await ResolvePhoneBaseUrlAsync();
        if (root.Length == 0) return null;
        if (string.IsNullOrWhiteSpace(path)) return root;
        if (path.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return path;
        }

        return root + (path.StartsWith('/') ? path : "/" + path);
    }

    public static string DetectPreferredLanBaseUrl() => DetectLanBaseUrl();

    private static string DetectLanBaseUrl()
    {
        string? best = null;
        var bestScore = int.MaxValue;
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != OperationalStatus.Up) continue;
            foreach (var item in nic.GetIPProperties().UnicastAddresses)
            {
                if (item.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                if (IPAddress.IsLoopback(item.Address)) continue;
                var ip = item.Address.ToString();
                var score = ip.StartsWith("192.168.40.", StringComparison.Ordinal) ? 0
                    : ip.StartsWith("192.168.1.", StringComparison.Ordinal) || ip.StartsWith("192.168.0.", StringComparison.Ordinal) ? 1
                    : ip.StartsWith("192.168.56.", StringComparison.Ordinal)
                        || ip.StartsWith("192.168.239.", StringComparison.Ordinal)
                        || ip.StartsWith("192.168.85.", StringComparison.Ordinal) ? 8
                    : 4;
                if (score < bestScore)
                {
                    bestScore = score;
                    best = ip;
                }
            }
        }

        return best is null ? string.Empty : "http://" + best + ":5173";
    }

    private static string NormalizeBaseUrl(string? value)
    {
        if (!Uri.TryCreate((value ?? string.Empty).Trim().TrimEnd('/'), UriKind.Absolute, out var uri))
        {
            return string.Empty;
        }

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return string.Empty;
        if (uri.Host is "127.0.0.1" or "localhost" or "::1") return string.Empty;
        return uri.GetLeftPart(UriPartial.Authority);
    }

    private static PhoneNotifyDto ToPhoneDto(string topic, string phoneBaseUrl) => new()
    {
        NtfyTopic = topic,
        NtfyUrl = "https://ntfy.sh/" + topic,
        PhoneBaseUrl = phoneBaseUrl,
    };

    private async Task<(string PublicKey, string PrivateKey)> EnsureKeysAsync()
    {
        using var connection = _factory.Create();
        var rows = (await connection.QueryAsync<SettingRow>("SELECT Key, Value FROM AppSettings WHERE Key IN ('PushVapidPublic', 'PushVapidPrivate')"))
            .ToDictionary(row => row.Key, row => row.Value, StringComparer.OrdinalIgnoreCase);
        if (rows.TryGetValue("PushVapidPublic", out var pub)
            && rows.TryGetValue("PushVapidPrivate", out var priv)
            && !string.IsNullOrWhiteSpace(pub)
            && !string.IsNullOrWhiteSpace(priv))
        {
            return (pub, priv);
        }

        var generated = VapidHelper.GenerateVapidKeys();
        await connection.ExecuteAsync(
            """
            INSERT INTO AppSettings (Key, Value) VALUES (@Key, @Value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
            """,
            new[]
            {
                new { Key = "PushVapidPublic", Value = generated.PublicKey },
                new { Key = "PushVapidPrivate", Value = generated.PrivateKey },
            });
        return (generated.PublicKey, generated.PrivateKey);
    }

    private sealed class SettingRow
    {
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }

    private sealed class PushRow
    {
        public string Endpoint { get; set; } = string.Empty;
        public string P256dh { get; set; } = string.Empty;
        public string Auth { get; set; } = string.Empty;
    }
}

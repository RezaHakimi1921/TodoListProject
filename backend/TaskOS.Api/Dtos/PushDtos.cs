using System.Text.Json.Serialization;

namespace TaskOS.Api.Dtos;

public sealed class PushPublicKeyDto
{
    [JsonPropertyName("publicKey")]
    public string PublicKey { get; set; } = string.Empty;
}

public sealed class PushSubscribeRequest
{
    public string Endpoint { get; set; } = string.Empty;
    public string? P256dh { get; set; }
    public string? Auth { get; set; }
    public PushSubscribeKeys? Keys { get; set; }
}

public sealed class PushSubscribeKeys
{
    public string? P256dh { get; set; }
    public string? Auth { get; set; }
}

public sealed class PushTestRequest
{
    public string? Title { get; set; }
    public string? Body { get; set; }
}

public sealed class PhoneNotifyDto
{
    [JsonPropertyName("ntfyTopic")]
    public string NtfyTopic { get; set; } = string.Empty;

    [JsonPropertyName("ntfyUrl")]
    public string NtfyUrl { get; set; } = string.Empty;

    [JsonPropertyName("phoneBaseUrl")]
    public string PhoneBaseUrl { get; set; } = string.Empty;
}

public sealed class PhoneNotifyRequest
{
    public string? NtfyTopic { get; set; }
    public string? PhoneBaseUrl { get; set; }
}

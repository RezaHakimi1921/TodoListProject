namespace TaskOS.Api.Dtos;

public sealed class AppSettingsDto
{
    public int PingMinutes { get; set; } = 10;
    public bool Paused { get; set; }
    public string? LastPingAt { get; set; }
}

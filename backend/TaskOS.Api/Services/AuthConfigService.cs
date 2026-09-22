using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IAuthConfigService
{
    Task<AuthSystemConfigDto> GetAsync();
    Task<AuthSystemConfigDto> UpdateAsync(UpdateAuthSystemConfigRequest request);
    Task<MailRuntimeConfig> GetMailAsync();
    Task<GoogleRuntimeConfig> GetGoogleAsync();
}

public sealed class MailRuntimeConfig
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string From { get; set; } = string.Empty;
    public string FromName { get; set; } = "TaskOS";
    public bool IsConfigured => Host.Length > 0 && From.Length > 0 && Username.Length > 0 && Password.Length > 0;
}

public sealed class GoogleRuntimeConfig
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public bool IsConfigured => ClientId.Length > 0;
}

public sealed class AuthConfigService : IAuthConfigService
{
    private readonly SqliteConnectionFactory _factory;
    private readonly IConfiguration _config;

    public AuthConfigService(SqliteConnectionFactory factory, IConfiguration config)
    {
        _factory = factory;
        _config = config;
    }

    public async Task<AuthSystemConfigDto> GetAsync()
    {
        var mail = await GetMailAsync();
        var google = await GetGoogleAsync();
        return new AuthSystemConfigDto
        {
            MailHost = mail.Host,
            MailPort = mail.Port,
            MailUseSsl = mail.UseSsl,
            MailUsername = mail.Username,
            MailFrom = mail.From,
            MailFromName = mail.FromName,
            MailConfigured = mail.IsConfigured,
            HasMailPassword = mail.Password.Length > 0,
            GoogleClientId = google.ClientId,
            GoogleConfigured = google.IsConfigured,
            HasGoogleClientSecret = google.ClientSecret.Length > 0,
        };
    }

    public async Task<AuthSystemConfigDto> UpdateAsync(UpdateAuthSystemConfigRequest request)
    {
        using var connection = _factory.Create();
        await WriteAsync(connection, "AuthMail:Host", (request.MailHost ?? string.Empty).Trim());
        await WriteAsync(connection, "AuthMail:Port", (request.MailPort <= 0 ? 587 : request.MailPort).ToString());
        await WriteAsync(connection, "AuthMail:UseSsl", request.MailUseSsl ? "1" : "0");
        await WriteAsync(connection, "AuthMail:Username", (request.MailUsername ?? string.Empty).Trim());
        await WriteAsync(connection, "AuthMail:From", (request.MailFrom ?? string.Empty).Trim());
        await WriteAsync(connection, "AuthMail:FromName", string.IsNullOrWhiteSpace(request.MailFromName) ? "TaskOS" : request.MailFromName.Trim());
        if (request.MailPassword is not null)
        {
            await WriteAsync(connection, "AuthMail:Password", request.MailPassword);
        }

        await WriteAsync(connection, "AuthGoogle:ClientId", (request.GoogleClientId ?? string.Empty).Trim());
        if (request.GoogleClientSecret is not null)
        {
            await WriteAsync(connection, "AuthGoogle:ClientSecret", request.GoogleClientSecret);
        }

        return await GetAsync();
    }

    public async Task<MailRuntimeConfig> GetMailAsync()
    {
        var rows = await LoadRowsAsync();
        return new MailRuntimeConfig
        {
            Host = First(rows, "AuthMail:Host", _config["Mail:Host"]),
            Port = ParseInt(First(rows, "AuthMail:Port", _config["Mail:Port"]), 587),
            UseSsl = First(rows, "AuthMail:UseSsl", _config["Mail:UseSsl"]) is not "0" and not "false",
            Username = First(rows, "AuthMail:Username", _config["Mail:Username"]),
            Password = First(rows, "AuthMail:Password", _config["Mail:Password"]),
            From = First(rows, "AuthMail:From", _config["Mail:From"]),
            FromName = First(rows, "AuthMail:FromName", _config["Mail:FromName"], "TaskOS"),
        };
    }

    public async Task<GoogleRuntimeConfig> GetGoogleAsync()
    {
        var rows = await LoadRowsAsync();
        return new GoogleRuntimeConfig
        {
            ClientId = First(rows, "AuthGoogle:ClientId", _config["Google:ClientId"]),
            ClientSecret = First(rows, "AuthGoogle:ClientSecret", _config["Google:ClientSecret"]),
        };
    }

    private async Task<Dictionary<string, string>> LoadRowsAsync()
    {
        using var connection = _factory.Create();
        var rows = await connection.QueryAsync<(string Key, string Value)>("SELECT Key, Value FROM AppSettings");
        return rows.ToDictionary(r => r.Key, r => r.Value ?? string.Empty, StringComparer.OrdinalIgnoreCase);
    }

    private static async Task WriteAsync(System.Data.IDbConnection connection, string key, string value)
    {
        await connection.ExecuteAsync(
            """
            INSERT INTO AppSettings (Key, Value) VALUES (@Key, @Value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
            """,
            new { Key = key, Value = value ?? string.Empty });
    }

    private static string First(IReadOnlyDictionary<string, string> rows, string key, string? fallback = null, string defaultValue = "")
    {
        if (rows.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            return value.Trim();
        if (!string.IsNullOrWhiteSpace(fallback))
            return fallback.Trim();
        return defaultValue;
    }

    private static int ParseInt(string? raw, int fallback) =>
        int.TryParse(raw, out var value) ? value : fallback;
}

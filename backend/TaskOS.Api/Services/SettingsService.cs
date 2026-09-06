using Dapper;
using Microsoft.Data.Sqlite;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public sealed class SettingsService : ISettingsService
{
    public const int DefaultPingMinutes = 10;
    private readonly SqliteConnectionFactory _factory;

    public SettingsService(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<AppSettingsDto> GetAsync()
    {
        using var connection = _factory.Create();
        var rows = (await connection.QueryAsync<SettingRow>("SELECT Key, Value FROM AppSettings"))
            .ToDictionary(row => row.Key, row => row.Value, StringComparer.OrdinalIgnoreCase);

        if (!rows.ContainsKey("LastPingAt"))
        {
            var now = TaskMapping.Now();
            await WriteAsync(connection, "LastPingAt", now);
            rows["LastPingAt"] = now;
        }

        return new AppSettingsDto
        {
            PingMinutes = ParsePing(Get(rows, "PingMinutes")),
            Paused = Get(rows, "Paused") == "1",
            LastPingAt = Get(rows, "LastPingAt")
        };
    }

    public async Task<AppSettingsDto> UpdateAsync(AppSettingsDto request)
    {
        var minutes = Clamp(request.PingMinutes);
        using var connection = _factory.Create();
        await WriteAsync(connection, "PingMinutes", minutes.ToString());
        await WriteAsync(connection, "Paused", request.Paused ? "1" : "0");
        return await GetAsync();
    }

    public async Task<AppSettingsDto> MarkPingAsync()
    {
        using var connection = _factory.Create();
        await WriteAsync(connection, "LastPingAt", TaskMapping.Now());
        return await GetAsync();
    }

    private static string? Get(IReadOnlyDictionary<string, string> rows, string key) =>
        rows.TryGetValue(key, out var value) ? value : null;

    private static Task<int> WriteAsync(SqliteConnection connection, string key, string value) =>
        connection.ExecuteAsync("""
            INSERT INTO AppSettings (Key, Value) VALUES (@Key, @Value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
            """, new { Key = key, Value = value });

    private static int ParsePing(string? raw) =>
        int.TryParse(raw, out var value) ? Clamp(value) : DefaultPingMinutes;

    private static int Clamp(int value) => Math.Clamp(value, 1, 180);

    private sealed class SettingRow
    {
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }
}

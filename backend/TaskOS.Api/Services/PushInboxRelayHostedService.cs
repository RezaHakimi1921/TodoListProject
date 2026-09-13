using Dapper;
using TaskOS.Api.Data;

namespace TaskOS.Api.Services;

/// <summary>
/// Old API processes still insert Jira inbox rows. This host watches the table
/// and sends Web Push so the phone gets comments without restarting 5088.
/// </summary>
public sealed class PushInboxRelayHostedService : BackgroundService
{
    private readonly SqliteConnectionFactory _factory;
    private readonly IPushNotificationService _push;
    private readonly ILogger<PushInboxRelayHostedService> _logger;

    public PushInboxRelayHostedService(
        SqliteConnectionFactory factory,
        IPushNotificationService push,
        ILogger<PushInboxRelayHostedService> logger)
    {
        _factory = factory;
        _push = push;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await CatchUpCursorAsync(stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DrainAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Push inbox relay failed");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(8), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task CatchUpCursorAsync(CancellationToken stoppingToken)
    {
        using var connection = _factory.Create();
        var last = await connection.ExecuteScalarAsync<string?>(
            "SELECT Value FROM AppSettings WHERE Key = 'PushLastInboxId'");
        if (!string.IsNullOrWhiteSpace(last)) return;

        var maxId = await connection.ExecuteScalarAsync<long?>(
            "SELECT MAX(Id) FROM JiraCommentInbox") ?? 0;
        await connection.ExecuteAsync(
            """
            INSERT INTO AppSettings (Key, Value) VALUES ('PushLastInboxId', @Value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
            """,
            new { Value = maxId.ToString() });
        _logger.LogInformation("Push inbox relay starting after id {LastId}", maxId);
        stoppingToken.ThrowIfCancellationRequested();
    }

    private async Task DrainAsync(CancellationToken stoppingToken)
    {
        using var connection = _factory.Create();
        var lastText = await connection.ExecuteScalarAsync<string?>(
            "SELECT Value FROM AppSettings WHERE Key = 'PushLastInboxId'");
        var lastId = long.TryParse(lastText, out var parsed) ? parsed : 0;
        var rows = (await connection.QueryAsync<InboxRow>(
            """
            SELECT Id, TaskId, JiraKey, CommentId, AuthorName, Body
            FROM JiraCommentInbox
            WHERE Id > @LastId
            ORDER BY Id
            LIMIT 20
            """,
            new { LastId = lastId })).ToList();
        if (rows.Count == 0) return;

        foreach (var row in rows)
        {
            stoppingToken.ThrowIfCancellationRequested();
            var isNewTask = (row.CommentId ?? "").StartsWith("new-task:", StringComparison.OrdinalIgnoreCase);
            var key = (row.JiraKey ?? "").Trim().ToUpperInvariant();
            var title = isNewTask
                ? "تسک جدید جیرا"
                : $"{(string.IsNullOrWhiteSpace(row.AuthorName) ? "کسی" : row.AuthorName.Trim())} روی {key}";
            var body = isNewTask
                ? (string.IsNullOrWhiteSpace(row.Body) ? key : row.Body.Trim())
                : (row.Body ?? "").Trim();
            await _push.SendAsync(title, body, $"/tasks/{row.TaskId}");
            await connection.ExecuteAsync(
                """
                INSERT INTO AppSettings (Key, Value) VALUES ('PushLastInboxId', @Value)
                ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
                """,
                new { Value = row.Id.ToString() });
        }
    }

    private sealed class InboxRow
    {
        public long Id { get; set; }
        public int TaskId { get; set; }
        public string JiraKey { get; set; } = string.Empty;
        public string CommentId { get; set; } = string.Empty;
        public string AuthorName { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
    }
}

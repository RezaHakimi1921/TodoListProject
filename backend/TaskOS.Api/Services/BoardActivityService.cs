using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using TaskOS.Api.Data;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;

namespace TaskOS.Api.Services;

public sealed class BoardActivityService : IBoardActivityService
{
    private static readonly Regex KeyPattern = new(@"^[A-Z][A-Z0-9]+-\d+$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly SqliteConnectionFactory _factory;
    private readonly ICurrentUser _user;

    public BoardActivityService(SqliteConnectionFactory factory, ICurrentUser user)
    {
        _factory = factory;
        _user = user;
    }

    private string StorageKey
    {
        get
        {
            var uid = string.IsNullOrWhiteSpace(_user.UserId) ? "reza" : _user.UserId.Trim().ToLowerInvariant();
            return "BoardActivities:" + uid;
        }
    }

    private string OwnerId =>
        string.IsNullOrWhiteSpace(_user.UserId) ? "reza" : _user.UserId.Trim().ToLowerInvariant();

    public async Task<IReadOnlyList<BoardActivityDto>> ListAsync(bool enabledOnly = false)
    {
        var items = await LoadOrSeedAsync();
        if (enabledOnly)
        {
            items = items.Where(row => row.Enabled).ToList();
        }

        return items
            .OrderBy(row => row.SortOrder)
            .ThenBy(row => row.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<IReadOnlyList<BoardActivityDto>> SaveAsync(IEnumerable<BoardActivityDto>? items)
    {
        var cleaned = Normalize(items ?? Array.Empty<BoardActivityDto>());
        await WriteAsync(cleaned);
        return await ListAsync();
    }

    public async Task<BoardActivityDto?> FindByTitleAsync(string? title)
    {
        var needle = (title ?? string.Empty).Trim();
        if (needle.Length == 0) return null;
        var items = await ListAsync(enabledOnly: true);
        return items.FirstOrDefault(row => row.Title.Equals(needle, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<bool> IsActivityKeyAsync(string? jiraKey)
    {
        var key = NormalizeKey(jiraKey);
        if (key.Length == 0) return false;
        if (key.Equals(ActivityJira.NotificationKey, StringComparison.OrdinalIgnoreCase)) return true;
        var items = await ListAsync();
        return items.Any(row => row.JiraKey.Equals(key, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<bool> NeedsNoteAsync(string? title)
    {
        var found = await FindByTitleAsync(title);
        if (found is not null) return found.NeedsNote;
        return ActivityJira.NeedsNote(title);
    }

    private async Task<List<BoardActivityDto>> LoadOrSeedAsync()
    {
        using var connection = _factory.Create();
        var raw = await connection.ExecuteScalarAsync<string?>(
            "SELECT Value FROM AppSettings WHERE Key = @Key",
            new { Key = StorageKey });

        if (!string.IsNullOrWhiteSpace(raw))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<List<BoardActivityDto>>(raw, JsonOptions) ?? [];
                return Normalize(parsed);
            }
            catch (JsonException)
            {
                // fall through to empty/seed
            }
        }

        // Only the original reza account inherits the historic SIP shortcuts.
        // New users start empty and configure their own board in Settings.
        var seeded = OwnerId.Equals("reza", StringComparison.OrdinalIgnoreCase)
            ? LegacyDefaults()
            : [];
        await WriteAsync(seeded);
        return seeded;
    }

    private async Task WriteAsync(IReadOnlyList<BoardActivityDto> items)
    {
        var json = JsonSerializer.Serialize(items, JsonOptions);
        using var connection = _factory.Create();
        await connection.ExecuteAsync(
            """
            INSERT INTO AppSettings (Key, Value) VALUES (@Key, @Value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value
            """,
            new { Key = StorageKey, Value = json });
    }

    private static List<BoardActivityDto> Normalize(IEnumerable<BoardActivityDto> items)
    {
        var result = new List<BoardActivityDto>();
        var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var order = 0;
        foreach (var item in items)
        {
            var title = (item.Title ?? string.Empty).Trim();
            var key = NormalizeKey(item.JiraKey);
            if (title.Length == 0 || key.Length == 0 || !KeyPattern.IsMatch(key)) continue;
            if (!seenKeys.Add(key)) continue;

            var kind = string.Equals(item.Kind, "meeting", StringComparison.OrdinalIgnoreCase) ? "meeting" : "rest";
            var url = string.IsNullOrWhiteSpace(item.JiraUrl)
                ? ActivityJira.BrowseUrl(key)
                : item.JiraUrl.Trim();
            result.Add(new BoardActivityDto
            {
                Id = string.IsNullOrWhiteSpace(item.Id) ? Guid.NewGuid().ToString("N")[..12] : item.Id.Trim(),
                Title = title,
                JiraKey = key,
                JiraUrl = url,
                Kind = kind,
                NeedsNote = item.NeedsNote || kind == "meeting",
                SortOrder = order++,
                Enabled = item.Enabled,
            });
        }

        return result;
    }

    private static string NormalizeKey(string? raw) =>
        (raw ?? string.Empty).Trim().ToUpperInvariant();

    private static List<BoardActivityDto> LegacyDefaults() =>
    [
        new() { Id = "legacy-lunch", Title = "نهار", JiraKey = "SIP-2290", JiraUrl = ActivityJira.BrowseUrl("SIP-2290"), Kind = "rest", NeedsNote = false, SortOrder = 0, Enabled = true },
        new() { Id = "legacy-rest", Title = "استراحت", JiraKey = "SIP-2287", JiraUrl = ActivityJira.BrowseUrl("SIP-2287"), Kind = "rest", NeedsNote = false, SortOrder = 1, Enabled = true },
        new() { Id = "legacy-daily", Title = "دیلی", JiraKey = "SIP-2288", JiraUrl = ActivityJira.BrowseUrl("SIP-2288"), Kind = "meeting", NeedsNote = true, SortOrder = 2, Enabled = true },
        new() { Id = "legacy-meeting", Title = "جلسه", JiraKey = "SIP-2289", JiraUrl = ActivityJira.BrowseUrl("SIP-2289"), Kind = "meeting", NeedsNote = true, SortOrder = 3, Enabled = true },
        new() { Id = "legacy-team", Title = "صحبت تیم", JiraKey = "SIP-2356", JiraUrl = ActivityJira.BrowseUrl("SIP-2356"), Kind = "meeting", NeedsNote = true, SortOrder = 4, Enabled = true },
    ];
}

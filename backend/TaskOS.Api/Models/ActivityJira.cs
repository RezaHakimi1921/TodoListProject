namespace TaskOS.Api.Models;

public static class ActivityJira
{
    public const string NotificationKey = "SIP-2286";

    public static readonly IReadOnlyDictionary<string, string> KeysByTitle =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["استراحت"] = "SIP-2287",
            ["دیلی"] = "SIP-2288",
            ["جلسه"] = "SIP-2289",
            ["نهار"] = "SIP-2290",
        };

    public static bool TryGetKey(string? title, out string key)
    {
        key = string.Empty;
        return !string.IsNullOrWhiteSpace(title) && KeysByTitle.TryGetValue(title.Trim(), out key!);
    }

    public static bool IsActivity(string? jiraKey)
    {
        var key = (jiraKey ?? string.Empty).Trim().ToUpperInvariant();
        foreach (var item in KeysByTitle.Values)
        {
            if (item.Equals(key, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    public static bool NeedsNote(string? title)
    {
        var value = (title ?? string.Empty).Trim();
        return value.Equals("جلسه", StringComparison.OrdinalIgnoreCase)
            || value.Equals("دیلی", StringComparison.OrdinalIgnoreCase);
    }

    public static string? TitleFor(string? jiraKey)
    {
        var key = (jiraKey ?? string.Empty).Trim().ToUpperInvariant();
        foreach (var pair in KeysByTitle)
        {
            if (pair.Value.Equals(key, StringComparison.OrdinalIgnoreCase))
            {
                return pair.Key;
            }
        }

        return null;
    }

    public static string BrowseUrl(string key) => $"https://jira.smartx.ir/browse/{key.Trim().ToUpperInvariant()}";
}

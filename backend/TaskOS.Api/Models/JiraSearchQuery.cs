using System.Text.RegularExpressions;

namespace TaskOS.Api.Models;

/// <summary>
/// Turns a dashboard/form search string into Jira tokens.
/// Accepts PS-2851, a full Jira URL, or a bare ticket number like 2851.
/// </summary>
public static class JiraSearchQuery
{
    private static readonly Regex KeyInText = new(
        @"[A-Z][A-Z0-9]+-\d+",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex DigitsOnly = new(
        @"^\d{3,6}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public static (string? Q, string? Key, string? Digits) Parse(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return (null, null, null);
        }

        var q = raw.Trim();
        var matches = KeyInText.Matches(q);
        string? key = matches.Count == 0 ? null : matches[^1].Value.ToUpperInvariant();
        string? digits = null;
        if (key is not null)
        {
            var dash = key.LastIndexOf('-');
            if (dash >= 0 && dash < key.Length - 1)
            {
                digits = key[(dash + 1)..];
            }
        }
        else if (DigitsOnly.IsMatch(q))
        {
            digits = q;
        }

        return (q, key, digits);
    }

    public static bool Matches(string? title, string? meta, string? jiraKey, string? jiraUrl, string query)
    {
        var (_, key, digits) = Parse(query);
        if (string.IsNullOrWhiteSpace(query))
        {
            return true;
        }

        if (Contains(title, query) || Contains(meta, query) || Contains(jiraKey, query) || Contains(jiraUrl, query))
        {
            return true;
        }

        if (key is not null && (
                EqualsKey(jiraKey, key)
                || Contains(title, key)
                || Contains(jiraUrl, key)))
        {
            return true;
        }

        return digits is not null && (
            EndsWithTicketNumber(jiraKey, digits)
            || Contains(title, digits)
            || Contains(jiraUrl, digits));
    }

    private static bool Contains(string? hay, string needle) =>
        !string.IsNullOrWhiteSpace(hay)
        && hay.Contains(needle, StringComparison.OrdinalIgnoreCase);

    private static bool EqualsKey(string? hay, string key) =>
        !string.IsNullOrWhiteSpace(hay)
        && hay.Equals(key, StringComparison.OrdinalIgnoreCase);

    private static bool EndsWithTicketNumber(string? jiraKey, string digits) =>
        !string.IsNullOrWhiteSpace(jiraKey)
        && jiraKey.EndsWith("-" + digits, StringComparison.OrdinalIgnoreCase);
}

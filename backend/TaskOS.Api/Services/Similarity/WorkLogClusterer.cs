using System.Globalization;
using System.Text;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;

namespace TaskOS.Api.Services.Similarity;

public static class WorkLogClusterer
{
    private static readonly HashSet<string> Noise = new(StringComparer.OrdinalIgnoreCase)
    {
        "شروع", "کردم", "کرد", "رو", "برای", "که", "از", "به", "را", "این", "یک",
        "پیدا", "تست", "جواب", "داد", "لازمه", "بود", "شد", "مسئله", "گزینه"
    };

    public static WorkLogSummaryDto Cluster(string date, IReadOnlyList<WorkLogEntry> entries, double threshold)
    {
        var groups = new List<List<WorkLogEntry>>();

        foreach (var entry in entries.OrderBy(e => e.CreatedAt).ThenBy(e => e.Id))
        {
            var bestIndex = -1;
            var bestScore = 0d;
            for (var i = 0; i < groups.Count; i++)
            {
                var score = groups[i].Max(existing => WorkScore(entry.Description, existing.Description));
                if (score > bestScore)
                {
                    bestScore = score;
                    bestIndex = i;
                }
            }

            if (bestIndex >= 0 && bestScore >= threshold)
            {
                groups[bestIndex].Add(entry);
            }
            else
            {
                groups.Add([entry]);
            }
        }

        var dtoGroups = groups.Select(group => new WorkLogGroupDto
        {
            Title = PickTitle(group),
            TotalMinutes = group.Sum(item => item.DurationMinutes),
            Entries = group.Select(ToDto).ToList()
        }).ToList();

        var total = dtoGroups.Sum(group => group.TotalMinutes);
        return new WorkLogSummaryDto
        {
            Date = date,
            TotalMinutes = total,
            Groups = dtoGroups,
            CopyText = BuildCopyText(date, total, dtoGroups)
        };
    }

    private static double WorkScore(string left, string right)
    {
        var fuzzy = FuzzyMatcher.Score(left, right);
        var keywords = KeywordOverlap(left, right);
        return Math.Max(fuzzy, keywords);
    }

    private static double KeywordOverlap(string left, string right)
    {
        var a = Keywords(left);
        var b = Keywords(right);
        if (a.Count == 0 || b.Count == 0)
        {
            return 0;
        }

        var intersection = a.Intersect(b, StringComparer.OrdinalIgnoreCase).Count();
        var union = a.Union(b, StringComparer.OrdinalIgnoreCase).Count();
        return union == 0 ? 0 : intersection / (double)union;
    }

    private static HashSet<string> Keywords(string value)
    {
        return FuzzyMatcher.Normalize(value)
            .Replace('|', ' ')
            .Replace(':', ' ')
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(token => token.Length >= 2 && !Noise.Contains(token))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static WorkLogDto ToDto(WorkLogEntry entry) => WorkLogService.ToDto(entry);

    private static string PickTitle(IReadOnlyList<WorkLogEntry> group)
    {
        return group
            .OrderByDescending(item => Keywords(item.Description).Count)
            .ThenBy(item => item.CreatedAt)
            .Select(item => item.Description.Split('|')[0].Trim())
            .First();
    }

    private static string BuildCopyText(string date, int totalMinutes, IReadOnlyList<WorkLogGroupDto> groups)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"Work log {date} — {FormatDuration(totalMinutes)}");
        builder.AppendLine();
        foreach (var group in groups)
        {
            builder.AppendLine($"* {group.Title} — {FormatDuration(group.TotalMinutes)}");
            foreach (var entry in group.Entries)
            {
                builder.AppendLine($"  {FormatClock(entry.CreatedAt)} {entry.Description} ({entry.DurationMinutes}m)");
            }

            builder.AppendLine();
        }

        return builder.ToString().TrimEnd();
    }

    private static string FormatDuration(int minutes)
    {
        var hours = minutes / 60;
        var rest = minutes % 60;
        if (hours == 0) return $"{rest}m";
        return rest == 0 ? $"{hours}h" : $"{hours}h {rest}m";
    }

    private static string FormatClock(string timestamp)
    {
        if (!DateTime.TryParse(timestamp, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
        {
            return "--:--";
        }

        var local = parsed.Kind == DateTimeKind.Utc ? parsed.ToLocalTime() : parsed;
        return local.ToString("HH:mm", CultureInfo.InvariantCulture);
    }
}

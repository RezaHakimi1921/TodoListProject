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
        var dtoGroups = new List<WorkLogGroupDto>();

        foreach (var group in entries.Where(item => item.TaskId is int)
                     .GroupBy(item => item.TaskId!.Value)
                     .OrderBy(group => group.Min(item => item.CreatedAt)))
        {
            dtoGroups.Add(ToGroup(group.ToList(), LinkedTitle));
        }

        foreach (var group in entries.Where(item => item.TaskId is null && item.ProblemId is int)
                     .GroupBy(item => item.ProblemId!.Value)
                     .OrderBy(group => group.Min(item => item.CreatedAt)))
        {
            dtoGroups.Add(ToGroup(group.ToList(), ProblemTitle));
        }

        var loose = entries.Where(item => item.TaskId is null && item.ProblemId is null).ToList();
        var clusters = new List<List<WorkLogEntry>>();
        foreach (var entry in loose.OrderBy(item => item.CreatedAt).ThenBy(item => item.Id))
        {
            var bestIndex = -1;
            var bestScore = 0d;
            for (var i = 0; i < clusters.Count; i++)
            {
                var score = clusters[i].Max(existing => WorkScore(entry.Description, existing.Description));
                if (score > bestScore)
                {
                    bestScore = score;
                    bestIndex = i;
                }
            }

            if (bestIndex >= 0 && bestScore >= threshold)
            {
                clusters[bestIndex].Add(entry);
            }
            else
            {
                clusters.Add([entry]);
            }
        }

        dtoGroups.AddRange(clusters.Select(group => ToGroup(group, PickTitle)));

        var total = dtoGroups.Sum(group => group.TotalMinutes);
        return new WorkLogSummaryDto
        {
            Date = date,
            TotalMinutes = total,
            Groups = dtoGroups,
            CopyText = BuildCopyText(date, total, dtoGroups)
        };
    }

    private static WorkLogGroupDto ToGroup(IReadOnlyList<WorkLogEntry> group, Func<IReadOnlyList<WorkLogEntry>, string> title)
    {
        return new WorkLogGroupDto
        {
            Title = title(group),
            TotalMinutes = group.Sum(item => item.DurationMinutes),
            Entries = group.Select(ToDto).ToList()
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

    private static string LinkedTitle(IReadOnlyList<WorkLogEntry> group)
    {
        var title = group.Select(item => item.TaskTitle).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
        if (!string.IsNullOrWhiteSpace(title))
        {
            var key = group.Select(item => item.JiraKey).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
            return string.IsNullOrWhiteSpace(key) ? title : $"{key} {title}";
        }

        var jira = group.Select(item => item.JiraKey).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
        return string.IsNullOrWhiteSpace(jira) ? PickTitle(group) : jira;
    }

    private static string ProblemTitle(IReadOnlyList<WorkLogEntry> group)
    {
        return group.Select(item => item.ProblemTitle).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))
               ?? PickTitle(group);
    }

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
                var label = !string.IsNullOrWhiteSpace(entry.TaskTitle) ? entry.TaskTitle
                    : !string.IsNullOrWhiteSpace(entry.ProblemTitle) ? entry.ProblemTitle
                    : entry.Description;
                builder.AppendLine($"  {FormatClock(entry.CreatedAt)} {label} ({entry.DurationMinutes}m)");
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

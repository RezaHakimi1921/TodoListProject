using TaskOS.Api.Dtos;
using TaskOS.Api.Models;

namespace TaskOS.Api.Services;

internal static class TaskMapping
{
    public static IReadOnlyList<string> SplitTags(string? tags) =>
        string.IsNullOrWhiteSpace(tags)
            ? []
            : tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

    public static string? JoinTags(string? tags, IReadOnlyList<string>? tagList)
    {
        var values = new List<string>();
        if (tagList is { Count: > 0 })
        {
            values.AddRange(tagList);
        }
        else if (!string.IsNullOrWhiteSpace(tags))
        {
            values.AddRange(SplitTags(tags));
        }

        values = values
            .Select(t => t.Trim())
            .Where(t => t.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return values.Count == 0 ? null : string.Join(',', values);
    }

    public static string Now() => DateTime.UtcNow.ToString("o");

    public static string TodayLocal()
    {
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById("Iran Standard Time");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone).ToString("yyyy-MM-dd");
        }
        catch (TimeZoneNotFoundException)
        {
            return DateTime.UtcNow.AddHours(3.5).ToString("yyyy-MM-dd");
        }
    }

    public static TaskDto ToDto(TaskRecord record, int agingDaysThreshold)
    {
        var agingDays = DaysSince(record.UpdatedAt);
        var isAging = TaskStatuses.IsActive(record.Status) && agingDays >= agingDaysThreshold;
        return new TaskDto
        {
            Id = record.Id,
            Title = record.Title,
            Status = record.Status,
            EnergyType = record.EnergyType,
            Tags = SplitTags(record.Tags),
            StuckReason = record.StuckReason,
            IsAging = isAging,
            AgingDays = agingDays,
            CreatedAt = record.CreatedAt,
            UpdatedAt = record.UpdatedAt,
            DoneAt = record.DoneAt
        };
    }

    public static TimelineEntryDto ToDto(TaskTimelineEntry entry) => new()
    {
        Id = entry.Id,
        TaskId = entry.TaskId,
        Note = entry.Note,
        CreatedAt = entry.CreatedAt
    };

    private static int DaysSince(string timestamp)
    {
        if (!DateTime.TryParse(timestamp, out var parsed))
        {
            return 0;
        }

        var utc = parsed.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc)
            : parsed.ToUniversalTime();
        return Math.Max(0, (int)(DateTime.UtcNow - utc).TotalDays);
    }
}

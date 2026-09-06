using System.Globalization;
using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;
using TaskOS.Api.Services.Similarity;

namespace TaskOS.Api.Services;

public sealed class WorkLogService : IWorkLogService
{
    private readonly IWorkLogRepository _logs;
    private readonly double _clusterThreshold;

    public WorkLogService(IWorkLogRepository logs, IConfiguration configuration)
    {
        _logs = logs;
        _clusterThreshold = configuration.GetValue("TaskOS:WorkLogClusterThreshold", 0.5);
    }

    public async Task<WorkLogDto> CaptureAsync(CaptureWorkLogRequest request)
    {
        var description = request.Description.Trim();
        if (description.Length == 0)
        {
            throw new ArgumentException("Description is required.");
        }

        var minutes = request.DurationMinutes ?? 15;
        if (minutes is < 1 or > 480)
        {
            throw new ArgumentException("durationMinutes must be between 1 and 480.");
        }

        var source = string.IsNullOrWhiteSpace(request.Source) ? WorkLogSources.Manual : request.Source.Trim();
        if (!WorkLogSources.All.Contains(source))
        {
            throw new ArgumentException("Source must be Timer, Extension, or Manual.");
        }

        var created = await _logs.CreateAsync(new WorkLogEntry
        {
            Description = description,
            DurationMinutes = minutes,
            Source = source,
            TaskId = request.TaskId,
            ProblemId = request.ProblemId,
            CreatedAt = TaskMapping.Now()
        });

        return ToDto(created);
    }

    public async Task<IReadOnlyList<WorkLogDto>> ListByDateAsync(string logDate)
    {
        var date = NormalizeDate(logDate);
        var rows = await _logs.ListByDateAsync(date);
        return rows.Select(ToDto).ToList();
    }

    public async Task<WorkLogSummaryDto> GetSummaryAsync(string logDate)
    {
        var date = NormalizeDate(logDate);
        var rows = await _logs.ListByDateAsync(date);
        return WorkLogClusterer.Cluster(date, rows, _clusterThreshold);
    }

    public async Task<EntityWorkLogDto> ListByTaskAsync(int taskId)
    {
        var rows = await _logs.ListByTaskAsync(taskId);
        return ToEntity(rows);
    }

    public async Task<EntityWorkLogDto> ListByProblemAsync(int problemId)
    {
        var rows = await _logs.ListByProblemAsync(problemId);
        return ToEntity(rows);
    }

    public static WorkLogDto ToDto(WorkLogEntry entry) => new()
    {
        Id = entry.Id,
        Description = entry.Description,
        DurationMinutes = entry.DurationMinutes,
        Source = entry.Source,
        TaskId = entry.TaskId,
        ProblemId = entry.ProblemId,
        CreatedAt = entry.CreatedAt
    };

    private static EntityWorkLogDto ToEntity(IReadOnlyList<WorkLogEntry> rows) => new()
    {
        TotalMinutes = rows.Sum(item => item.DurationMinutes),
        Entries = rows.Select(ToDto).ToList()
    };

    private static string NormalizeDate(string logDate)
    {
        if (!DateOnly.TryParseExact(logDate.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            throw new ArgumentException("date must be yyyy-MM-dd.");
        }

        return parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }
}

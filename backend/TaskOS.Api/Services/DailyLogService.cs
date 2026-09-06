using System.Globalization;
using TaskOS.Api.Dtos;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class DailyLogService : IDailyLogService
{
    private readonly IDailyLogRepository _logs;
    private readonly ITaskService _tasks;

    public DailyLogService(IDailyLogRepository logs, ITaskService tasks)
    {
        _logs = logs;
        _tasks = tasks;
    }

    public async Task<DailyLogDto?> GetByDateAsync(string logDate)
    {
        var normalized = NormalizeDate(logDate);
        var row = await _logs.GetByDateAsync(normalized);
        return row is null ? null : ToDto(row);
    }

    public async Task<IReadOnlyList<DailyLogDto>> ListAsync()
    {
        var rows = await _logs.ListAsync();
        return rows.Select(ToDto).ToList();
    }

    public async Task<DailyLogDto> UpsertAsync(UpsertDailyLogRequest request)
    {
        var date = NormalizeDate(request.LogDate);
        var note = request.Note.Trim();
        if (note.Length == 0)
        {
            throw new ArgumentException("Note is required.");
        }

        var row = await _logs.UpsertAsync(date, note, TaskMapping.Now());
        return ToDto(row);
    }

    public Task<IReadOnlyList<TaskDto>> GetRelatedTasksAsync(string logDate) =>
        _tasks.ListRelatedToDateAsync(NormalizeDate(logDate));

    private static string NormalizeDate(string logDate)
    {
        if (!DateOnly.TryParseExact(logDate.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            throw new ArgumentException("logDate must be yyyy-MM-dd.");
        }

        return parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static DailyLogDto ToDto(Models.DailyLog row) => new()
    {
        Id = row.Id,
        LogDate = row.LogDate,
        Note = row.Note,
        CreatedAt = row.CreatedAt
    };
}

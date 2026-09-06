using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class ProblemService : IProblemService
{
    private readonly IProblemRepository _problems;
    private readonly IWorkLogService _workLogs;
    private readonly ITrashService _trash;

    public ProblemService(IProblemRepository problems, IWorkLogService workLogs, ITrashService trash)
    {
        _problems = problems;
        _workLogs = workLogs;
        _trash = trash;
    }

    public async Task<IReadOnlyList<ProblemDto>> ListAsync()
    {
        var rows = await _problems.ListAsync();
        var result = new List<ProblemDto>();
        foreach (var row in rows)
        {
            result.Add(await MapAsync(row));
        }

        return result;
    }

    public async Task<ProblemDto?> GetAsync(int id)
    {
        var row = await _problems.GetAsync(id);
        return row is null ? null : await MapAsync(row);
    }

    public async Task<ProblemDto> CreateAsync(CreateProblemRequest request)
    {
        var title = Require(request.Title, "Title is required.");
        var now = TaskMapping.Now();
        var id = await _problems.CreateAsync(new ProblemRecord
        {
            Title = title,
            Status = ProblemStatuses.Exploring,
            CreatedAt = now,
            UpdatedAt = now
        });
        return (await GetAsync(id))!;
    }

    public async Task<ProblemDto?> UpdateAsync(int id, UpdateProblemRequest request)
    {
        var row = await _problems.GetAsync(id);
        if (row is null) return null;
        row.Title = Require(request.Title, "Title is required.");
        row.NoTimeNote = EmptyToNull(request.NoTimeNote);
        row.InfiniteTimeNote = EmptyToNull(request.InfiniteTimeNote);
        row.UpdatedAt = TaskMapping.Now();
        await _problems.UpdateAsync(row);
        return await MapAsync(row);
    }

    public async Task<ProblemDto?> AddOptionAsync(int id, UpsertOptionRequest request)
    {
        var row = await _problems.GetAsync(id);
        if (row is null) return null;
        var options = await _problems.ListOptionsAsync(id);
        await _problems.AddOptionAsync(new ProblemOptionRecord
        {
            ProblemId = id,
            Title = Require(request.Title, "Option title is required."),
            JuniorExplain = EmptyToNull(request.JuniorExplain),
            SortOrder = options.Count,
            CreatedAt = TaskMapping.Now()
        });
        row.UpdatedAt = TaskMapping.Now();
        await _problems.UpdateAsync(row);
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> UpdateOptionAsync(int id, int optionId, UpsertOptionRequest request)
    {
        var option = await _problems.GetOptionAsync(id, optionId);
        if (option is null) return null;
        option.Title = Require(request.Title, "Option title is required.");
        option.JuniorExplain = EmptyToNull(request.JuniorExplain);
        await _problems.UpdateOptionAsync(option);
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> DeleteOptionAsync(int id, int optionId)
    {
        var row = await _problems.GetAsync(id);
        if (row is null) return null;
        var option = await _problems.GetOptionAsync(id, optionId);
        if (option is null) return null;
        await _trash.SoftDeleteAsync(TrashKinds.Option, optionId);
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> ChooseAsync(int id, ChooseOptionRequest request)
    {
        var row = await _problems.GetAsync(id);
        if (row is null) return null;
        var options = await _problems.ListOptionsAsync(id);
        var blocker = GetBlocker(options);
        if (blocker is not null)
        {
            throw new ArgumentException(blocker);
        }

        var chosen = options.FirstOrDefault(item => item.Id == request.OptionId)
                     ?? throw new ArgumentException("Option not found.");
        var sign = Require(request.PremortemSign, "Premortem sign is required before choosing.");

        row.ChosenOptionId = chosen.Id;
        row.PremortemSign = sign;
        row.Status = ProblemStatuses.Chosen;
        row.UpdatedAt = TaskMapping.Now();
        await _problems.UpdateAsync(row);

        await _workLogs.CaptureAsync(new CaptureWorkLogRequest
        {
            Description = $"مسئله: {row.Title} | انتخاب: {chosen.Title} | هنوز تست نشده",
            DurationMinutes = 15,
            Source = WorkLogSources.Manual
        });

        return await GetAsync(id);
    }

    public async Task<ProblemDto?> ValidateAsync(int id, ValidateProblemRequest request)
    {
        var row = await _problems.GetAsync(id);
        if (row is null) return null;
        if (row.Status != ProblemStatuses.Chosen || row.ChosenOptionId is null)
        {
            throw new ArgumentException("Validate only after an option is chosen.");
        }

        var chosen = await _problems.GetOptionAsync(id, row.ChosenOptionId.Value);
        row.Status = ProblemStatuses.Validated;
        row.UpdatedAt = TaskMapping.Now();
        await _problems.UpdateAsync(row);

        var note = string.IsNullOrWhiteSpace(request.Note) ? "تست کردم، جواب داد" : request.Note.Trim();
        await _workLogs.CaptureAsync(new CaptureWorkLogRequest
        {
            Description = $"مسئله: {row.Title} | تست شد: {chosen?.Title} | {note}",
            DurationMinutes = 15,
            Source = WorkLogSources.Manual
        });

        return await GetAsync(id);
    }

    private async Task<ProblemDto> MapAsync(ProblemRecord row)
    {
        var options = await _problems.ListOptionsAsync(row.Id);
        var blocker = GetBlocker(options);
        return new ProblemDto
        {
            Id = row.Id,
            Title = row.Title,
            Status = row.Status,
            NoTimeNote = row.NoTimeNote,
            InfiniteTimeNote = row.InfiniteTimeNote,
            ChosenOptionId = row.ChosenOptionId,
            PremortemSign = row.PremortemSign,
            Options = options.Select(option => new ProblemOptionDto
            {
                Id = option.Id,
                Title = option.Title,
                JuniorExplain = option.JuniorExplain,
                SortOrder = option.SortOrder,
                IsChosen = row.ChosenOptionId == option.Id
            }).ToList(),
            CanChoose = blocker is null,
            Blocker = blocker,
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt
        };
    }

    private static string? GetBlocker(IReadOnlyList<ProblemOptionRecord> options)
    {
        var filled = options.Where(item => !string.IsNullOrWhiteSpace(item.Title)).ToList();
        if (filled.Count < 3)
        {
            return "قانون گزینه سوم: تا سه گزینه ننویسی نمی‌توانی انتخاب کنی.";
        }

        if (filled.Any(item => string.IsNullOrWhiteSpace(item.JuniorExplain)))
        {
            return "هر گزینه را در یک جمله برای جونیور بنویس، بعد انتخاب کن.";
        }

        return null;
    }

    private static string Require(string? value, string message)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (trimmed.Length == 0) throw new ArgumentException(message);
        return trimmed;
    }

    private static string? EmptyToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

using TaskOS.Api.Dtos;
using TaskOS.Api.Models;
using TaskOS.Api.Repositories;

namespace TaskOS.Api.Services;

public sealed class ProblemService : IProblemService
{
    private readonly IProblemRepository _problems;
    private readonly ITaskRepository _tasks;
    private readonly ITrashService _trash;

    public ProblemService(IProblemRepository problems, ITaskRepository tasks, ITrashService trash)
    {
        _problems = problems;
        _tasks = tasks;
        _trash = trash;
    }

    public async Task<IReadOnlyList<ProblemDto>> ListAsync()
    {
        var rows = await _problems.ListAsync();
        var result = new List<ProblemDto>();
        foreach (var row in rows)
        {
            result.Add(await MapAsync(row, includeTasks: false));
        }

        return result;
    }

    public async Task<ProblemDto?> GetAsync(int id)
    {
        var row = await _problems.GetAsync(id);
        return row is null ? null : await MapAsync(row, includeTasks: true);
    }

    public async Task<ProblemDto> CreateAsync(CreateProblemRequest request)
    {
        var title = Require(request.Title, "Title is required.");
        var now = TaskMapping.Now();
        var id = await _problems.CreateAsync(new ProblemRecord
        {
            Title = title,
            Status = ProblemStatuses.Open,
            CreatedAt = now,
            UpdatedAt = now
        });
        if (request.TaskId is int taskId)
        {
            await AttachTaskAsync(id, taskId);
        }

        return (await GetAsync(id))!;
    }

    public async Task<ProblemDto?> UpdateAsync(int id, UpdateProblemRequest request)
    {
        var row = await _problems.GetAsync(id);
        if (row is null) return null;
        row.Title = Require(request.Title, "Title is required.");
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            row.Status = ProblemStatuses.Normalize(request.Status);
        }
        row.Reality = EmptyToNull(request.Reality ?? request.NoTimeNote);
        row.ExpectedBehavior = EmptyToNull(request.ExpectedBehavior);
        row.ActualBehavior = EmptyToNull(request.ActualBehavior);
        row.RootCause = EmptyToNull(request.RootCause);
        row.DetectionGap = EmptyToNull(request.DetectionGap);
        row.AffectedPopulation = EmptyToNull(request.AffectedPopulation);
        row.Resolution = EmptyToNull(request.Resolution);
        row.Recovery = EmptyToNull(request.Recovery);
        row.ValidationNote = EmptyToNull(request.ValidationNote);
        row.Prevention = EmptyToNull(request.Prevention);
        row.ImpactBranches = EmptyToNull(request.ImpactBranches);
        row.ImpactCustomers = EmptyToNull(request.ImpactCustomers);
        row.ImpactRecords = EmptyToNull(request.ImpactRecords);
        row.ImpactServices = EmptyToNull(request.ImpactServices);
        row.ImpactSupport = EmptyToNull(request.ImpactSupport);
        row.ImpactBusiness = EmptyToNull(request.ImpactBusiness);
        row.StartedAt = EmptyToNull(request.StartedAt);
        row.FirstAffectedAt = EmptyToNull(request.FirstAffectedAt);
        row.DetectedAt = EmptyToNull(request.DetectedAt);
        row.RootCauseFoundAt = EmptyToNull(request.RootCauseFoundAt);
        row.FixedAt = EmptyToNull(request.FixedAt);
        row.RecoveryCompletedAt = EmptyToNull(request.RecoveryCompletedAt);
        row.CostTechnical = EmptyToNull(request.CostTechnical);
        row.CostOperational = EmptyToNull(request.CostOperational);
        row.CostBusiness = EmptyToNull(request.CostBusiness);
        row.CostOpportunity = EmptyToNull(request.CostOpportunity);
        row.SectionSavedAt = EmptyToNull(request.SectionSavedAt);
        row.NoTimeNote = EmptyToNull(request.Reality ?? request.NoTimeNote);
        row.InfiniteTimeNote = EmptyToNull(request.InfiniteTimeNote);
        row.UpdatedAt = TaskMapping.Now();
        await _problems.UpdateAsync(row);
        if (request.AttachTaskIds is { Count: > 0 } attachIds)
        {
            return await AttachTasksAsync(id, attachIds);
        }
        return await GetAsync(id);
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
        var chosen = options.FirstOrDefault(item => item.Id == request.OptionId)
                     ?? throw new ArgumentException("Option not found.");
        var sign = Require(request.PremortemSign, "Premortem sign is required before choosing.");
        row.ChosenOptionId = chosen.Id;
        row.PremortemSign = sign;
        row.Status = ProblemStatuses.Monitoring;
        row.UpdatedAt = TaskMapping.Now();
        await _problems.UpdateAsync(row);
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> ValidateAsync(int id, ValidateProblemRequest request)
    {
        var row = await _problems.GetAsync(id);
        if (row is null) return null;
        row.Status = ProblemStatuses.Resolved;
        if (!string.IsNullOrWhiteSpace(request.Note))
        {
            row.ValidationNote = request.Note.Trim();
        }
        row.UpdatedAt = TaskMapping.Now();
        await _problems.UpdateAsync(row);
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> AddActionAsync(int id, UpsertProblemActionRequest request)
    {
        if (await _problems.GetAsync(id) is null) return null;
        var now = TaskMapping.Now();
        await _problems.AddActionAsync(new ProblemActionRecord
        {
            ProblemId = id,
            Title = Require(request.Title, "Action title is required."),
            Owner = EmptyToNull(request.Owner),
            Deadline = EmptyToNull(request.Deadline),
            Status = string.Equals(request.Status, ProblemActionStatuses.Done, StringComparison.OrdinalIgnoreCase)
                ? ProblemActionStatuses.Done
                : ProblemActionStatuses.Open,
            CreatedAt = now,
            UpdatedAt = now
        });
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> UpdateActionAsync(int id, int actionId, UpsertProblemActionRequest request)
    {
        var action = await _problems.GetActionAsync(id, actionId);
        if (action is null) return null;
        action.Title = Require(request.Title, "Action title is required.");
        action.Owner = EmptyToNull(request.Owner);
        action.Deadline = EmptyToNull(request.Deadline);
        action.Status = string.Equals(request.Status, ProblemActionStatuses.Done, StringComparison.OrdinalIgnoreCase)
            ? ProblemActionStatuses.Done
            : ProblemActionStatuses.Open;
        action.UpdatedAt = TaskMapping.Now();
        await _problems.UpdateActionAsync(action);
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> DeleteActionAsync(int id, int actionId)
    {
        if (await _problems.GetAsync(id) is null) return null;
        await _problems.DeleteActionAsync(id, actionId);
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> AttachTaskAsync(int id, int taskId) =>
        await AttachTasksAsync(id, [taskId]);

    public async Task<ProblemDto?> AttachTasksAsync(int id, IReadOnlyList<int> taskIds)
    {
        if (await _problems.GetAsync(id) is null) return null;
        var ids = taskIds.Where(item => item > 0).Distinct().ToArray();
        if (ids.Length == 0) throw new ArgumentException("Task not found.");
        var now = TaskMapping.Now();
        foreach (var taskId in ids)
        {
            var task = await _tasks.GetByIdAsync(taskId);
            if (task is null) throw new ArgumentException("Task not found.");
            await _problems.AttachTaskAsync(id, taskId, now);
        }
        return await GetAsync(id);
    }

    public async Task<ProblemDto?> DetachTaskAsync(int id, int taskId)
    {
        if (await _problems.GetAsync(id) is null) return null;
        await _problems.DetachTaskAsync(id, taskId);
        return await GetAsync(id);
    }

    public async Task<IReadOnlyList<ProblemLinkDto>> ListByTaskAsync(int taskId)
    {
        var rows = await _problems.ListProblemsForTaskAsync(taskId);
        return rows.Select(row => new ProblemLinkDto
        {
            Id = row.ProblemId,
            Title = row.ProblemTitle,
            Status = ProblemStatuses.Normalize(row.ProblemStatus)
        }).ToList();
    }

    private async Task<ProblemDto> MapAsync(ProblemRecord row, bool includeTasks)
    {
        var options = await _problems.ListOptionsAsync(row.Id);
        var actions = await _problems.ListActionsAsync(row.Id);
        var taskLinks = includeTasks
            ? await _problems.ListTasksAsync(row.Id)
            : [];
        var taskCount = includeTasks ? taskLinks.Count : await _problems.CountTasksAsync(row.Id);
        return new ProblemDto
        {
            Id = row.Id,
            Title = row.Title,
            Status = ProblemStatuses.Normalize(row.Status),
            Reality = row.Reality ?? row.NoTimeNote,
            ExpectedBehavior = row.ExpectedBehavior,
            ActualBehavior = row.ActualBehavior,
            RootCause = row.RootCause,
            DetectionGap = row.DetectionGap,
            AffectedPopulation = row.AffectedPopulation,
            Resolution = row.Resolution,
            Recovery = row.Recovery,
            ValidationNote = row.ValidationNote,
            Prevention = row.Prevention,
            ImpactBranches = row.ImpactBranches,
            ImpactCustomers = row.ImpactCustomers,
            ImpactRecords = row.ImpactRecords,
            ImpactServices = row.ImpactServices,
            ImpactSupport = row.ImpactSupport,
            ImpactBusiness = row.ImpactBusiness,
            StartedAt = row.StartedAt,
            FirstAffectedAt = row.FirstAffectedAt,
            DetectedAt = row.DetectedAt,
            RootCauseFoundAt = row.RootCauseFoundAt,
            FixedAt = row.FixedAt,
            RecoveryCompletedAt = row.RecoveryCompletedAt,
            CostTechnical = row.CostTechnical,
            CostOperational = row.CostOperational,
            CostBusiness = row.CostBusiness,
            CostOpportunity = row.CostOpportunity,
            SectionSavedAt = row.SectionSavedAt,
            TaskCount = taskCount,
            Tasks = taskLinks.Select(link => new ProblemTaskDto
            {
                Id = link.TaskId,
                Title = link.TaskTitle,
                Status = link.TaskStatus,
                JiraKey = link.JiraKey,
                JiraUrl = link.JiraUrl
            }).ToList(),
            Actions = actions.Select(action => new ProblemActionDto
            {
                Id = action.Id,
                Title = action.Title,
                Owner = action.Owner,
                Deadline = action.Deadline,
                Status = action.Status
            }).ToList(),
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
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt
        };
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

using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface IBoardActivityService
{
    Task<IReadOnlyList<BoardActivityDto>> ListAsync(bool enabledOnly = false);
    Task<IReadOnlyList<BoardActivityDto>> SaveAsync(IEnumerable<BoardActivityDto>? items);
    Task<BoardActivityDto?> FindByTitleAsync(string? title);
    Task<bool> IsActivityKeyAsync(string? jiraKey);
    Task<bool> NeedsNoteAsync(string? title);
}

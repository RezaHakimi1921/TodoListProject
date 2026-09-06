using TaskOS.Api.Dtos;

namespace TaskOS.Api.Services;

public interface ITrashService
{
    Task<IReadOnlyList<TrashItemDto>> ListAsync();
    Task SoftDeleteAsync(string kind, int id);
    Task RestoreAsync(string kind, int id);
    Task PurgeAsync(string kind, int id);
    Task EmptyAsync();
}

namespace TaskOS.Api.Dtos;

public sealed class DailyLogDto
{
    public int Id { get; set; }
    public string LogDate { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class UpsertDailyLogRequest
{
    public string LogDate { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}

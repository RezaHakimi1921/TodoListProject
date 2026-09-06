namespace TaskOS.Api.Models;

public sealed class DailyLog
{
    public int Id { get; set; }
    public string LogDate { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

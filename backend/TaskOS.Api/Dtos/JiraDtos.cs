namespace TaskOS.Api.Dtos;

public sealed class JiraSeenRequest
{
    public string JiraKey { get; set; } = string.Empty;
    public string? JiraUrl { get; set; }
    public string? Title { get; set; }
}

public sealed class JiraStartRequest
{
    public string JiraKey { get; set; } = string.Empty;
    public string? JiraUrl { get; set; }
    public string? Title { get; set; }
    public bool FinishPrevious { get; set; }
    public bool MarkPreviousDone { get; set; }
    public int? DurationMinutes { get; set; }
    public string? EnergyType { get; set; }
}

public sealed class AddJiraCommentRequest
{
    public string Body { get; set; } = string.Empty;
}

public sealed class JiraSeenDto
{
    public string JiraKey { get; set; } = string.Empty;
    public string? JiraUrl { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public int OpenCount { get; set; }
    public JiraTaskRefDto? MatchedTask { get; set; }
    public JiraFocusRefDto? CurrentFocus { get; set; }
}

public sealed class JiraTaskRefDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int OpenCount { get; set; }
}

public sealed class JiraFocusRefDto
{
    public bool Active { get; set; }
    public string Description { get; set; } = string.Empty;
    public int? TaskId { get; set; }
    public string? JiraKey { get; set; }
}

public sealed class JiraWatchRequest
{
    public string JiraKey { get; set; } = string.Empty;
    public string? JiraUrl { get; set; }
    public string? Title { get; set; }
    public long SinceUnixMs { get; set; }
}

public sealed class JiraSwitchPendingDto
{
    public string JiraKey { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int RemainingSeconds { get; set; }
    public long SinceUnixMs { get; set; }
    public int? TaskId { get; set; }
}

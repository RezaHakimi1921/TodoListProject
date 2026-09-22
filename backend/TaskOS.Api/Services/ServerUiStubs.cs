namespace TaskOS.Api.Services;

public enum WorkPingChoice
{
    Dismissed,
    Submit,
    Break,
    Pause
}

public sealed class WorkPickItem
{
    public string Kind { get; init; } = "";
    public int? Id { get; init; }
    public string Title { get; init; } = "";
    public string Meta { get; init; } = "";
    public string? JiraKey { get; init; }
    public string? JiraUrl { get; init; }
}

public sealed class WorkPingResult
{
    public WorkPingChoice Choice { get; init; } = WorkPingChoice.Dismissed;
    public int Minutes { get; init; }
    public WorkPickItem? Work { get; init; }
    public string EnergyType { get; init; } = "Light";
}

public enum DoneCommentChoice
{
    Dismissed,
    ReturnToTask
}

public enum SwitchAskChoice
{
    Dismissed,
    SwitchDone,
    JustChecking,
    Rest
}

/// <summary>No-op desktop UI for Linux/server builds (TaskOSServer=true).</summary>
public static class WindowsToast
{
    public static void Show(string title, string body, string? url = null) { }
}

public static class StartupInstaller
{
    public static void Ensure(string contentRoot) { }
}

public static class WorkPingForm
{
    public static WorkPingResult ShowCentered(
        string heading,
        string body,
        int suggestedMinutes,
        IReadOnlyList<WorkPickItem> items,
        Func<string, string, WorkPickItem?>? createTask = null,
        Func<string, WorkPickItem?>? createProblem = null) =>
        new() { Choice = WorkPingChoice.Dismissed, Minutes = suggestedMinutes };
}

public static class DoneCommentForm
{
    public static DoneCommentChoice ShowCentered(string title, string comment) =>
        DoneCommentChoice.Dismissed;
}

public static class SwitchAskForm
{
    public static SwitchAskChoice ShowCentered(string previous, string next) =>
        SwitchAskChoice.Dismissed;
}

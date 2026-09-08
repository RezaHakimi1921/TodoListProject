namespace TaskOS.Api.Models;

public static class TaskStatuses
{
    public const string Open = "Open";
    public const string Doing = "Doing";
    public const string Stuck = "Stuck";
    public const string Done = "Done";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Open, Doing, Stuck, Done
    };

    public static bool IsActive(string status) =>
        status.Equals(Open, StringComparison.OrdinalIgnoreCase)
        || status.Equals(Doing, StringComparison.OrdinalIgnoreCase);
}

public static class EnergyTypes
{
    public const string Deep = "Deep";
    public const string Light = "Light";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Deep, Light
    };
}

public static class TaskOwnerships
{
    public const string Mine = "Mine";
    public const string Other = "Other";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Mine, Other
    };

    public static string Normalize(string? value) =>
        string.Equals(value, Other, StringComparison.OrdinalIgnoreCase) ? Other : Mine;
}

public static class StuckReasons
{
    public const string WaitingOnSomeone = "منتظر کسی‌ام";
    public const string Forgot = "یادم رفت";
    public const string TooHard = "سخته";
    public const string NoLongerMatters = "مهم نیست دیگه";

    public static readonly HashSet<string> All = new(StringComparer.Ordinal)
    {
        WaitingOnSomeone, Forgot, TooHard, NoLongerMatters
    };
}

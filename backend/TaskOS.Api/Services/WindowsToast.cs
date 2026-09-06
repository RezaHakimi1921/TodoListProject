using Microsoft.Toolkit.Uwp.Notifications;

namespace TaskOS.Api.Services;

public static class WindowsToast
{
    public static void Show(string title, string body, string? url = null)
    {
        var builder = new ToastContentBuilder()
            .AddText(title)
            .AddText(body);

        _ = url;
        builder.Show();
    }
}

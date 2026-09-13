using System.Runtime.InteropServices;
using Microsoft.Toolkit.Uwp.Notifications;

namespace TaskOS.Api.Services;

public static class WindowsToast
{
    private const string AppId = "TaskOS.Desktop";

    static WindowsToast()
    {
        try
        {
            SetCurrentProcessExplicitAppUserModelID(AppId);
        }
        catch
        {
            // Toast can still work without an explicit id.
        }
    }

    public static void Show(string title, string body, string? url = null)
    {
        Exception? error = null;
        void ShowCore()
        {
            var builder = new ToastContentBuilder()
                .AddText(string.IsNullOrWhiteSpace(title) ? "TaskOS" : title.Trim())
                .AddText(string.IsNullOrWhiteSpace(body) ? "یک اعلان جدید" : body.Trim());
            _ = url;
            builder.Show(toast =>
            {
                toast.ExpirationTime = DateTimeOffset.Now.AddHours(2);
            });
        }

        if (Thread.CurrentThread.GetApartmentState() == ApartmentState.STA)
        {
            ShowCore();
            return;
        }

        var done = new ManualResetEventSlim(false);
        var thread = new Thread(() =>
        {
            try
            {
                ShowCore();
            }
            catch (Exception ex)
            {
                error = ex;
            }
            finally
            {
                done.Set();
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = true;
        thread.Start();
        if (!done.Wait(TimeSpan.FromSeconds(5)) && error is null)
        {
            throw new TimeoutException("Windows toast timed out.");
        }

        if (error is not null) throw error;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appID);
}

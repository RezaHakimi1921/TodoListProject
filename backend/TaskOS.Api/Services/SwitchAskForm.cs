using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace TaskOS.Api.Services;

public enum SwitchAskChoice
{
    Dismissed,
    SwitchDone,
    JustChecking,
    Rest
}

public sealed class SwitchAskForm : Form
{
    public SwitchAskChoice Choice { get; private set; } = SwitchAskChoice.Dismissed;
    private int _frontTicks;

    public SwitchAskForm(string previous, string next)
    {
        Text = "TaskOS — تعویض کار";
        RightToLeft = RightToLeft.Yes;
        RightToLeftLayout = true;
        StartPosition = FormStartPosition.Manual;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        TopMost = true;
        ShowInTaskbar = true;
        KeyPreview = true;
        ClientSize = new Size(520, 420);
        BackColor = Color.FromArgb(14, 17, 24);
        ForeColor = Color.FromArgb(226, 232, 240);
        Font = new Font("Tahoma", 11f);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(18),
            ColumnCount = 1,
            RowCount = 6
        };
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        root.Controls.Add(Label("بیش از ۳۰ ثانیه روی تیکت جدید ماندی. تعویض کنم؟", Color.FromArgb(251, 191, 36), 12f, true), 0, 0);
        root.Controls.Add(Label($"قبلی: {previous}\nجدید: {next}", Color.FromArgb(203, 213, 225), 10f, false), 0, 1);

        var done = ActionButton("کار قبلی تمام شد — برو سراغ این کار", Color.FromArgb(217, 119, 6));
        done.Click += (_, _) => CloseWith(SwitchAskChoice.SwitchDone);
        var check = ActionButton("داشتم فقط چک می‌کردم", Color.FromArgb(51, 65, 85));
        check.Click += (_, _) => CloseWith(SwitchAskChoice.JustChecking);
        var rest = ActionButton("استراحت / ناهار بود، کار نبود", Color.FromArgb(30, 64, 80));
        rest.Click += (_, _) => CloseWith(SwitchAskChoice.Rest);

        root.Controls.Add(done, 0, 3);
        root.Controls.Add(check, 0, 4);
        root.Controls.Add(rest, 0, 5);
        Controls.Add(root);
        Load += (_, _) =>
        {
            PlaceOnWorkingScreen();
            StartForegroundGuard();
        };
        Shown += (_, _) => ForceToFront();
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) Close(); };
    }

    public static SwitchAskChoice ShowCentered(string previous, string next)
    {
        SwitchAskChoice choice = SwitchAskChoice.Dismissed;
        var thread = new Thread(() =>
        {
            try
            {
                Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
                Application.EnableVisualStyles();
                using var form = new SwitchAskForm(previous, next);
                form.ShowDialog();
                choice = form.Choice;
            }
            catch
            {
                choice = SwitchAskChoice.Dismissed;
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = false;
        thread.Start();
        thread.Join();
        return choice;
    }

    private void CloseWith(SwitchAskChoice choice)
    {
        Choice = choice;
        Close();
    }

    private void PlaceOnWorkingScreen()
    {
        var foreground = GetForegroundWindow();
        var screen = foreground != IntPtr.Zero
            ? Screen.FromHandle(foreground)
            : Screen.FromPoint(Cursor.Position);
        var area = screen.WorkingArea;
        Left = area.Left + Math.Max(0, (area.Width - Width) / 2);
        Top = area.Top + Math.Max(0, (area.Height - Height) / 2);
    }

    private void StartForegroundGuard()
    {
        ForceToFront();
        var timer = new System.Windows.Forms.Timer { Interval = 150 };
        timer.Tick += (_, _) =>
        {
            ForceToFront();
            _frontTicks++;
            if (_frontTicks >= 8) timer.Stop();
        };
        timer.Start();
    }

    private void ForceToFront()
    {
        TopMost = true;
        WindowState = FormWindowState.Normal;
        BringToFront();
        Activate();
        var hwnd = Handle;
        ShowWindow(hwnd, 9);
        SetWindowPos(hwnd, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040);
        var foreground = GetForegroundWindow();
        var thisThread = GetCurrentThreadId();
        var other = GetWindowThreadProcessId(foreground, out _);
        if (other != thisThread)
        {
            AttachThreadInput(other, thisThread, true);
            BringWindowToTop(hwnd);
            SetForegroundWindow(hwnd);
            AttachThreadInput(other, thisThread, false);
        }
        else SetForegroundWindow(hwnd);
    }

    private static Label Label(string text, Color color, float size, bool bold) =>
        new()
        {
            Text = text,
            ForeColor = color,
            AutoSize = true,
            MaximumSize = new Size(470, 0),
            Font = new Font("Tahoma", size, bold ? FontStyle.Bold : FontStyle.Regular),
            Margin = new Padding(0, 0, 0, 12)
        };

    private static Button ActionButton(string text, Color back) =>
        new()
        {
            Text = text,
            Dock = DockStyle.Top,
            Height = 46,
            FlatStyle = FlatStyle.Flat,
            BackColor = back,
            ForeColor = Color.White,
            Margin = new Padding(0, 0, 0, 8)
        };

    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
}

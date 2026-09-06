using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

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

internal sealed class ListRow
{
    public bool IsHeader { get; init; }
    public string Text { get; init; } = "";
    public WorkPickItem? Item { get; init; }
}

public sealed class WorkPingForm : Form
{
    private readonly ListBox _list;
    private readonly NumericUpDown _minutes;
    private readonly TextBox _newTitle;
    private readonly TextBox _search;
    private readonly List<WorkPickItem> _allItems;
    private readonly Label _hint;
    private readonly Button _submit;
    private readonly Button _break;
    private readonly List<Button> _chips = [];
    private readonly Func<string, string, WorkPickItem?>? _createTask;
    private readonly Func<string, WorkPickItem?>? _createProblem;
    private readonly Button _energyDeep;
    private readonly Button _energyLight;
    private readonly Button? _choicePrevious;
    private readonly Button? _choiceNew;
    private int _pickedMinutes;
    private string _energy = "Light";
    private bool _allowClose;
    private int _frontTicks;

    public WorkPingResult Result { get; private set; } = new();

    public WorkPingForm(
        string heading,
        string body,
        int suggestedMinutes,
        IReadOnlyList<WorkPickItem> items,
        Func<string, string, WorkPickItem?>? createTask,
        Func<string, WorkPickItem?>? createProblem)
    {
        _ = suggestedMinutes;
        _createTask = createTask;
        _createProblem = createProblem;
        _allItems = items.ToList();
        Text = "TaskOS — چیکار می‌کنی؟";
        RightToLeft = RightToLeft.Yes;
        RightToLeftLayout = true;
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        ControlBox = false;
        MaximizeBox = false;
        MinimizeBox = false;
        TopMost = true;
        ShowInTaskbar = true;
        TopLevel = true;
        KeyPreview = true;
        ClientSize = new Size(660, 860);
        BackColor = Color.FromArgb(18, 16, 13);
        ForeColor = Color.FromArgb(244, 239, 228);
        Font = new Font("Tahoma", 11f);
        Padding = new Padding(12);

        var shadow = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(12, 11, 9), Padding = new Padding(3) };
        var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(40, 36, 30), Padding = new Padding(18) };

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 10,
            BackColor = card.BackColor
        };
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        var hasSwitch = items.Any(item => item.Kind == "jira") && items.Any(item => item.Kind == "current");
        _energy = items.Any(item => item.Kind == "jira") ? "Deep" : "Light";

        root.Controls.Add(MakeLabel("چی کار می‌کنی؟", ForeColor, 20f, true), 0, 0);
        root.Controls.Add(MakeLabel(heading + (string.IsNullOrWhiteSpace(body) ? "" : Environment.NewLine + body), Color.FromArgb(200, 190, 170), 11f, false), 0, 1);

        var sectionHead = new TableLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, ColumnCount = 1, BackColor = card.BackColor };
        if (hasSwitch)
        {
            sectionHead.Controls.Add(MakeLabel("لینک جدید است — کدام را ادامه می‌دهی؟", Color.FromArgb(217, 119, 6), 10.5f, true), 0, 0);
            var choiceRow = new FlowLayoutPanel
            {
                AutoSize = true,
                FlowDirection = FlowDirection.RightToLeft,
                WrapContents = true,
                BackColor = card.BackColor
            };
            _choicePrevious = RaisedButton("ادامه کار قبلی", Color.FromArgb(58, 52, 42), ForeColor, 200, 40);
            _choiceNew = RaisedButton("ادامه با کار جدید", Color.FromArgb(217, 119, 6), Color.FromArgb(18, 17, 14), 200, 40);
            _choicePrevious.Click += (_, _) => SelectKind("current");
            _choiceNew.Click += (_, _) => SelectKind("jira");
            choiceRow.Controls.Add(_choiceNew);
            choiceRow.Controls.Add(_choicePrevious);
            sectionHead.Controls.Add(choiceRow, 0, 1);
        }
        else
        {
            _choicePrevious = null;
            _choiceNew = null;
        }
        sectionHead.Controls.Add(MakeLabel("۱) نوع بازه را انتخاب کن — اجباری", Color.FromArgb(217, 119, 6), 10.5f, true), 0, sectionHead.Controls.Count);
        root.Controls.Add(sectionHead, 0, 2);

        _list = new ListBox
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(22, 20, 17),
            ForeColor = ForeColor,
            BorderStyle = BorderStyle.None,
            IntegralHeight = false,
            DrawMode = DrawMode.OwnerDrawFixed,
            ItemHeight = 40,
            Font = new Font("Tahoma", 10.5f)
        };
        _list.DrawItem += DrawRow;
        _list.MouseDown += (_, e) =>
        {
            var index = _list.IndexFromPoint(e.Location);
            if (index >= 0) _list.SelectedIndex = index;
        };
        _list.SelectedIndexChanged += (_, _) =>
        {
            SkipHeaderSelection();
            RefreshActions();
        };
        _search = new TextBox
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(18, 17, 14),
            ForeColor = ForeColor,
            BorderStyle = BorderStyle.FixedSingle,
            Font = new Font("Tahoma", 11f),
            PlaceholderText = "جستجو در کارها، مسئله‌ها و Jira"
        };
        _search.TextChanged += (_, _) => ApplySearch();
        var listInner = new Panel { Dock = DockStyle.Fill, BackColor = _list.BackColor, Padding = new Padding(4) };
        listInner.Controls.Add(_list);
        var listStack = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Color.FromArgb(22, 20, 17),
            Padding = new Padding(4)
        };
        listStack.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        listStack.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        listStack.Controls.Add(_search, 0, 0);
        listStack.Controls.Add(listInner, 0, 1);
        var listFrame = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(70, 60, 46),
            Padding = new Padding(1)
        };
        listFrame.Controls.Add(listStack);
        root.Controls.Add(listFrame, 0, 3);
        ApplySearch();

        var createRow = new TableLayoutPanel { AutoSize = true, ColumnCount = 3, Dock = DockStyle.Fill, BackColor = card.BackColor };
        createRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        createRow.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        createRow.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        _newTitle = new TextBox
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(18, 17, 14),
            ForeColor = ForeColor,
            BorderStyle = BorderStyle.FixedSingle,
            Font = new Font("Tahoma", 11f)
        };
        var addTask = RaisedButton("کار جدید", Color.FromArgb(217, 119, 6), Color.FromArgb(18, 17, 14), 96, 36);
        var addProblem = RaisedButton("مسئله جدید", Color.FromArgb(70, 62, 48), ForeColor, 110, 36);
        addTask.Click += (_, _) => CreateIntoList("task");
        addProblem.Click += (_, _) => CreateIntoList("problem");
        createRow.Controls.Add(_newTitle, 0, 0);
        createRow.Controls.Add(addTask, 1, 0);
        createRow.Controls.Add(addProblem, 2, 0);

        var energyRow = new FlowLayoutPanel
        {
            AutoSize = true,
            FlowDirection = FlowDirection.RightToLeft,
            WrapContents = true,
            BackColor = card.BackColor
        };
        _energyDeep = RaisedButton("تمرکز عمیق", Color.FromArgb(58, 52, 42), ForeColor, 140, 36);
        _energyLight = RaisedButton("کار عادی", Color.FromArgb(58, 52, 42), ForeColor, 140, 36);
        _energyDeep.Click += (_, _) => SetEnergy("Deep");
        _energyLight.Click += (_, _) => SetEnergy("Light");
        energyRow.Controls.Add(_energyDeep);
        energyRow.Controls.Add(_energyLight);

        var mid = new TableLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, ColumnCount = 1, BackColor = card.BackColor };
        mid.Controls.Add(createRow, 0, 0);
        mid.Controls.Add(MakeLabel("تمرکز عمیق یا کار عادی؟ — اجباری", Color.FromArgb(217, 119, 6), 10.5f, true), 0, 1);
        mid.Controls.Add(energyRow, 0, 2);
        root.Controls.Add(mid, 0, 4);
        PaintEnergy();

        root.Controls.Add(MakeLabel("۲) چند دقیقه صرف شد؟ — اجباری", Color.FromArgb(217, 119, 6), 10.5f, true), 0, 5);

        _minutes = new NumericUpDown
        {
            Minimum = 0,
            Maximum = 480,
            Value = 0,
            Width = 92,
            Height = 34,
            BackColor = Color.FromArgb(18, 17, 14),
            ForeColor = ForeColor,
            DecimalPlaces = 0,
            ThousandsSeparator = false,
            InterceptArrowKeys = true
        };
        _minutes.ValueChanged += (_, _) => ApplyMinutes((int)_minutes.Value, writeControl: false);
        HookMinutesTyping();

        var timeRow = new FlowLayoutPanel
        {
            AutoSize = true,
            FlowDirection = FlowDirection.RightToLeft,
            WrapContents = true,
            BackColor = card.BackColor
        };
        foreach (var value in new[] { 5, 10, 15, 20, 30, 45, 60 })
        {
            var chip = RaisedButton($"{value}m", Color.FromArgb(58, 52, 42), ForeColor, 58, 34);
            var captured = value;
            chip.Click += (_, _) => ApplyMinutes(captured, writeControl: true);
            _chips.Add(chip);
            timeRow.Controls.Add(chip);
        }
        timeRow.Controls.Add(_minutes);
        root.Controls.Add(timeRow, 0, 6);

        var breakRow = new FlowLayoutPanel
        {
            AutoSize = true,
            FlowDirection = FlowDirection.RightToLeft,
            WrapContents = true,
            BackColor = card.BackColor
        };
        breakRow.Controls.Add(MakeLabel("استراحت:", Color.FromArgb(200, 190, 170), 9f, true));
        foreach (var title in new[] { "استراحت", "چای / قهوه", "ناهار / غذا", "انتظار / وقفه" })
        {
            var chip = RaisedButton(title, Color.FromArgb(48, 44, 38), ForeColor, 118, 32);
            var captured = title;
            chip.Click += (_, _) => SelectOrInsertBreak(captured);
            breakRow.Controls.Add(chip);
        }
        root.Controls.Add(breakRow, 0, 7);

        _hint = MakeLabel("دقیقه را بزن، بعد کار را ثبت کن یا بگو استراحت بود.", Color.FromArgb(250, 180, 180), 9f, false);
        root.Controls.Add(_hint, 0, 8);

        var actions = new FlowLayoutPanel
        {
            AutoSize = true,
            FlowDirection = FlowDirection.RightToLeft,
            WrapContents = true,
            BackColor = card.BackColor
        };
        _submit = RaisedButton("ثبت کار و زمان", Color.FromArgb(217, 119, 6), Color.FromArgb(18, 17, 14), 170, 46);
        _submit.Enabled = false;
        _submit.Click += (_, _) => TrySubmit();
        _break = RaisedButton("استراحت بود", Color.FromArgb(58, 52, 42), ForeColor, 150, 46);
        _break.Enabled = false;
        _break.Click += (_, _) => TryBreak();
        var pause = RaisedButton("سیستم را خاموش کن", Color.FromArgb(58, 52, 42), ForeColor, 170, 46);
        pause.Click += (_, _) => CloseWith(WorkPingChoice.Pause, 0, null);
        actions.Controls.Add(_submit);
        actions.Controls.Add(_break);
        actions.Controls.Add(pause);
        root.Controls.Add(actions, 0, 9);
        AcceptButton = _submit;
        SelectFirstWork();
        RefreshActions();

        card.Controls.Add(root);
        shadow.Controls.Add(card);
        Controls.Add(shadow);
        Shown += (_, _) => StartForegroundGuard();
        KeyDown += (_, e) =>
        {
            if (e.KeyCode is Keys.Escape or Keys.F4 && e.Alt) e.Handled = true;
        };
    }

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ClassStyle |= 0x200;
            cp.ExStyle |= 0x00000008;
            return cp;
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (!_allowClose)
        {
            e.Cancel = true;
            _hint.Text = "این پنجره را نمی‌شود بست. ثبت کن، استراحت بود، یا سیستم را خاموش کن.";
            _hint.ForeColor = Color.FromArgb(250, 180, 180);
            return;
        }
        base.OnFormClosing(e);
    }

    private void HookMinutesTyping()
    {
        foreach (Control control in _minutes.Controls)
        {
            if (control is not TextBox box) continue;
            box.ShortcutsEnabled = true;
            box.TextChanged += (_, _) => ReadMinutesFromText(box.Text);
            box.KeyUp += (_, _) => ReadMinutesFromText(box.Text);
        }
    }

    private void ReadMinutesFromText(string? raw)
    {
        var text = (raw ?? string.Empty).Trim();
        if (text.Length == 0 || text == "0")
        {
            ApplyMinutes(0, writeControl: false);
            return;
        }

        if (!int.TryParse(text, out var minutes) || minutes < 0)
        {
            return;
        }

        ApplyMinutes(Math.Clamp(minutes, 0, 480), writeControl: false);
    }

    private void ApplyMinutes(int minutes, bool writeControl)
    {
        minutes = Math.Clamp(minutes, 0, 480);
        if (writeControl && (int)_minutes.Value != minutes)
        {
            _minutes.Value = minutes;
        }

        if (_pickedMinutes == minutes) return;
        _pickedMinutes = minutes;
        PaintChips();
        RefreshActions();
    }

    private void TrySubmit()
    {
        ReadMinutesFromText(_minutes.Controls.OfType<TextBox>().FirstOrDefault()?.Text ?? _minutes.Value.ToString());
        if (CurrentWork() is not { } work || _pickedMinutes <= 0 || work.Kind == "break") return;
        CloseWith(WorkPingChoice.Submit, _pickedMinutes, work);
    }

    private void TryBreak()
    {
        ReadMinutesFromText(_minutes.Controls.OfType<TextBox>().FirstOrDefault()?.Text ?? _minutes.Value.ToString());
        if (_pickedMinutes <= 0) return;
        var work = CurrentWork() is { Kind: "break" } selected
            ? selected
            : new WorkPickItem { Kind = "break", Title = "استراحت", Meta = "غیرکار" };
        CloseWith(WorkPingChoice.Break, _pickedMinutes, work);
    }

    private void CloseWith(WorkPingChoice choice, int minutes, WorkPickItem? work)
    {
        Result = new WorkPingResult { Choice = choice, Minutes = minutes, Work = work, EnergyType = _energy };
        _allowClose = true;
        DialogResult = DialogResult.OK;
        Close();
    }

    private WorkPickItem? CurrentWork() =>
        _list.SelectedItem is ListRow { IsHeader: false, Item: { } item } ? item : null;

    private void RefreshActions()
    {
        if (_submit is null || _break is null || _hint is null) return;
        var work = CurrentWork();
        var hasTime = _pickedMinutes > 0;
        var isBreak = work?.Kind == "break";
        var isWork = work is not null && !isBreak;
        _submit.Enabled = isWork && hasTime;
        _break.Enabled = hasTime;
        PaintChoice();
        var energyFa = _energy == "Deep" ? "تمرکز عمیق" : "کار عادی";
        if (isWork && hasTime)
        {
            _hint.Text = $"آماده ثبت: {work!.Title} — {_pickedMinutes} دقیقه — {energyFa}";
            _hint.ForeColor = Color.FromArgb(160, 220, 170);
        }
        else if (hasTime && isBreak)
        {
            _hint.Text = $"آماده استراحت: {work!.Title} — {_pickedMinutes} دقیقه";
            _hint.ForeColor = Color.FromArgb(160, 220, 170);
        }
        else if (hasTime)
        {
            _hint.Text = $"{_pickedMinutes} دقیقه انتخاب شد — کار را بردار یا بگو استراحت بود.";
            _hint.ForeColor = Color.FromArgb(230, 210, 140);
        }
        else
        {
            _hint.Text = "دقیقه را بزن. برای ثبت کار، یک مورد هم از لیست لازم است.";
            _hint.ForeColor = Color.FromArgb(250, 180, 180);
        }
    }

    private void SetEnergy(string energy)
    {
        _energy = energy;
        PaintEnergy();
        RefreshActions();
    }

    private void PaintEnergy()
    {
        if (_energyDeep is null || _energyLight is null) return;
        var deep = _energy == "Deep";
        _energyDeep.BackColor = deep ? Color.FromArgb(217, 119, 6) : Color.FromArgb(58, 52, 42);
        _energyDeep.ForeColor = deep ? Color.FromArgb(18, 17, 14) : ForeColor;
        _energyLight.BackColor = !deep ? Color.FromArgb(217, 119, 6) : Color.FromArgb(58, 52, 42);
        _energyLight.ForeColor = !deep ? Color.FromArgb(18, 17, 14) : ForeColor;
    }

    private void SelectKind(string kind)
    {
        for (var i = 0; i < _list.Items.Count; i++)
        {
            if (_list.Items[i] is ListRow { IsHeader: false, Item.Kind: var itemKind } && itemKind == kind)
            {
                _list.SelectedIndex = i;
                RefreshActions();
                return;
            }
        }
    }

    private void PaintChoice()
    {
        if (_choicePrevious is null || _choiceNew is null) return;
        var work = CurrentWork();
        var prev = work?.Kind == "current";
        var next = work?.Kind == "jira";
        _choicePrevious.BackColor = prev ? Color.FromArgb(217, 119, 6) : Color.FromArgb(58, 52, 42);
        _choicePrevious.ForeColor = prev ? Color.FromArgb(18, 17, 14) : ForeColor;
        _choiceNew.BackColor = next ? Color.FromArgb(217, 119, 6) : Color.FromArgb(58, 52, 42);
        _choiceNew.ForeColor = next ? Color.FromArgb(18, 17, 14) : ForeColor;
    }

    private void PaintChips()
    {
        foreach (var chip in _chips)
        {
            var value = int.Parse(chip.Text.TrimEnd('m'));
            var on = value == _pickedMinutes;
            chip.BackColor = on ? Color.FromArgb(217, 119, 6) : Color.FromArgb(58, 52, 42);
            chip.ForeColor = on ? Color.FromArgb(18, 17, 14) : ForeColor;
        }
    }

    private void CreateIntoList(string kind)
    {
        var title = _newTitle.Text.Trim();
        if (title.Length == 0)
        {
            _hint.Text = kind == "task" ? "عنوان کار جدید را بنویس." : "عنوان مسئله جدید را بنویس.";
            _hint.ForeColor = Color.FromArgb(250, 180, 180);
            _newTitle.Focus();
            return;
        }

        WorkPickItem? created = null;
        try
        {
            created = kind == "task" ? _createTask?.Invoke(title, _energy) : _createProblem?.Invoke(title);
        }
        catch (Exception ex)
        {
            _hint.Text = ex.InnerException?.Message ?? ex.Message;
            _hint.ForeColor = Color.FromArgb(250, 180, 180);
            return;
        }

        if (created is null)
        {
            _hint.Text = "ثبت نشد.";
            _hint.ForeColor = Color.FromArgb(250, 180, 180);
            return;
        }

        InsertItem(created);
        _newTitle.Clear();
        RefreshActions();
    }

    private void SelectOrInsertBreak(string title)
    {
        for (var i = 0; i < _list.Items.Count; i++)
        {
            if (_list.Items[i] is ListRow { Item.Kind: "break" } row && row.Item.Title == title)
            {
                _list.SelectedIndex = i;
                RefreshActions();
                return;
            }
        }

        InsertItem(new WorkPickItem { Kind = "break", Title = title, Meta = "غیرکار" });
        RefreshActions();
    }

    private void ApplySearch()
    {
        if (_list is null || _allItems is null) return;
        var selected = CurrentWork();
        _list.Items.Clear();
        foreach (var row in BuildRows(FilteredItems())) _list.Items.Add(row);
        if (selected is not null)
        {
            for (var i = 0; i < _list.Items.Count; i++)
            {
                if (_list.Items[i] is ListRow { IsHeader: false, Item: { } item } && sameWork(selected, item))
                {
                    _list.SelectedIndex = i;
                    RefreshActions();
                    return;
                }
            }
        }

        SelectFirstWork();
        RefreshActions();
    }

    private static bool sameWork(WorkPickItem a, WorkPickItem b) =>
        a.Kind == b.Kind
        && a.Title == b.Title
        && a.Id == b.Id
        && a.JiraKey == b.JiraKey;

    private IReadOnlyList<WorkPickItem> FilteredItems()
    {
        var query = (_search?.Text ?? string.Empty).Trim();
        if (query.Length == 0) return _allItems;
        return _allItems.Where(item =>
            item.Title.Contains(query, StringComparison.OrdinalIgnoreCase)
            || item.Meta.Contains(query, StringComparison.OrdinalIgnoreCase)
            || (item.JiraKey?.Contains(query, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
    }

    private void InsertItem(WorkPickItem item)
    {
        _allItems.RemoveAll(existing => sameWork(existing, item));
        var at = item.Kind is "jira" or "current" ? 0 : _allItems.FindIndex(existing => existing.Kind == item.Kind);
        if (at < 0) _allItems.Add(item);
        else _allItems.Insert(at, item);
        if (_search.Text.Length > 0) _search.Clear();
        ApplySearch();
        for (var i = 0; i < _list.Items.Count; i++)
        {
            if (_list.Items[i] is ListRow { IsHeader: false, Item: { } row } && sameWork(row, item))
            {
                _list.SelectedIndex = i;
                break;
            }
        }
    }

    private void SelectFirstWork()
    {
        int? current = null;
        int? work = null;
        int? any = null;
        for (var i = 0; i < _list.Items.Count; i++)
        {
            if (_list.Items[i] is not ListRow { IsHeader: false, Item: { } item }) continue;
            any ??= i;
            if (item.Kind == "jira")
            {
                current = i;
                break;
            }
            if (item.Kind == "current")
            {
                current = i;
                break;
            }
            if (work is null && item.Kind is "task" or "problem") work = i;
        }

        var pick = current ?? work ?? any;
        if (pick is int index) _list.SelectedIndex = index;
    }

    private void SkipHeaderSelection()
    {
        if (_list.SelectedItem is not ListRow { IsHeader: true }) return;
        var next = _list.SelectedIndex + 1;
        while (next < _list.Items.Count && _list.Items[next] is ListRow { IsHeader: true }) next++;
        if (next < _list.Items.Count) _list.SelectedIndex = next;
        else if (_list.SelectedIndex > 0) _list.SelectedIndex--;
    }

    private static List<ListRow> BuildRows(IReadOnlyList<WorkPickItem> items)
    {
        var rows = new List<ListRow>();
        void AddGroup(string header, string kind)
        {
            var slice = items.Where(item => item.Kind == kind).ToList();
            if (slice.Count == 0) return;
            rows.Add(new ListRow { IsHeader = true, Text = header });
            foreach (var item in slice) rows.Add(new ListRow { Text = item.Title, Item = item });
        }
        AddGroup(items.Any(item => item.Kind == "jira" && item.Meta == "ادامه با کار جدید") ? "ادامه با کار جدید" : "تکت Jira", "jira");
        AddGroup(items.Any(item => item.Kind == "current" && item.Meta == "ادامه کار قبلی") ? "ادامه کار قبلی" : "کار فعلی", "current");
        AddGroup("کارها", "task");
        AddGroup("مسئله‌ها", "problem");
        AddGroup("استراحت و غیرکار", "break");
        return rows;
    }

    private void DrawRow(object? sender, DrawItemEventArgs e)
    {
        if (e.Index < 0 || _list.Items[e.Index] is not ListRow row) return;
        e.Graphics.FillRectangle(new SolidBrush(_list.BackColor), e.Bounds);
        var selected = (e.State & DrawItemState.Selected) == DrawItemState.Selected && !row.IsHeader;
        var bounds = Rectangle.Inflate(e.Bounds, -5, -4);
        using var back = new SolidBrush(row.IsHeader
            ? Color.FromArgb(56, 48, 36)
            : selected ? Color.FromArgb(217, 119, 6) : Color.FromArgb(32, 29, 24));
        using var path = Round(bounds, 10);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        e.Graphics.FillPath(back, path);
        if (!row.IsHeader)
        {
            using var edge = new Pen(selected ? Color.FromArgb(255, 186, 90) : Color.FromArgb(86, 76, 58));
            e.Graphics.DrawPath(edge, path);
        }
        var titleColor = row.IsHeader ? Color.FromArgb(232, 168, 80) : selected ? Color.FromArgb(18, 17, 14) : ForeColor;
        var title = row.IsHeader ? row.Text : row.Item!.Title;
        var meta = row.IsHeader ? "" : row.Item!.Meta;
        var flags = TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.RightToLeft;
        var titleBounds = new Rectangle(bounds.X + 10, bounds.Y, bounds.Width - 20, bounds.Height);
        TextRenderer.DrawText(e.Graphics, title, new Font("Tahoma", row.IsHeader ? 9f : 10.5f, FontStyle.Bold), titleBounds, titleColor, flags);
        if (!string.IsNullOrWhiteSpace(meta))
        {
            TextRenderer.DrawText(e.Graphics, meta, new Font("Tahoma", 8.5f), titleBounds, selected ? Color.FromArgb(70, 45, 12) : Color.FromArgb(176, 164, 142), TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.RightToLeft);
        }
    }

    private static GraphicsPath Round(Rectangle bounds, int radius)
    {
        var path = new GraphicsPath();
        var d = radius * 2;
        path.AddArc(bounds.X, bounds.Y, d, d, 180, 90);
        path.AddArc(bounds.Right - d, bounds.Y, d, d, 270, 90);
        path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
        path.AddArc(bounds.X, bounds.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    private static Label MakeLabel(string text, Color color, float size, bool bold) =>
        new()
        {
            Text = text,
            AutoSize = true,
            MaximumSize = new Size(580, 0),
            ForeColor = color,
            Font = new Font("Tahoma", size, bold ? FontStyle.Bold : FontStyle.Regular),
            Margin = new Padding(0, 2, 0, 8)
        };

    private static Button RaisedButton(string text, Color back, Color fore, int width, int height)
    {
        var button = new Button
        {
            Text = text,
            Width = width,
            Height = height,
            FlatStyle = FlatStyle.Flat,
            BackColor = back,
            ForeColor = fore,
            Cursor = Cursors.Hand,
            Margin = new Padding(4),
            Font = new Font("Tahoma", 9.5f, FontStyle.Bold)
        };
        button.FlatAppearance.BorderSize = 1;
        button.FlatAppearance.BorderColor = Color.FromArgb(Math.Min(255, back.R + 36), Math.Min(255, back.G + 30), Math.Min(255, back.B + 22));
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(Math.Min(255, back.R + 22), Math.Min(255, back.G + 16), Math.Min(255, back.B + 12));
        return button;
    }

    private void StartForegroundGuard()
    {
        ForceToFront();
        var timer = new System.Windows.Forms.Timer { Interval = 150 };
        timer.Tick += (_, _) =>
        {
            ForceToFront();
            _frontTicks++;
            if (_frontTicks >= 4) timer.Stop();
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

    public static WorkPingResult ShowCentered(
        string heading,
        string body,
        int suggestedMinutes,
        IReadOnlyList<WorkPickItem> items,
        Func<string, string, WorkPickItem?>? createTask = null,
        Func<string, WorkPickItem?>? createProblem = null)
    {
        WorkPingResult result = new();
        var thread = new Thread(() =>
        {
            try
            {
                Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
                Application.EnableVisualStyles();
                using var form = new WorkPingForm(heading, body, suggestedMinutes, items, createTask, createProblem);
                form.ShowDialog();
                result = form.Result;
            }
            catch (Exception)
            {
                result = new WorkPingResult { Choice = WorkPingChoice.Dismissed };
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = false;
        thread.Start();
        thread.Join();
        return result;
    }

    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
}

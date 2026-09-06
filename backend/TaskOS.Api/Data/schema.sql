PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Task (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Status TEXT NOT NULL CHECK (Status IN ('Open','Doing','Stuck','Done')) DEFAULT 'Open',
    EnergyType TEXT NOT NULL CHECK (EnergyType IN ('Deep','Light')) DEFAULT 'Light',
    Tags TEXT NULL,
    StuckReason TEXT NULL,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UpdatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    DoneAt TEXT NULL,
    DeletedAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS TaskJira (
    TaskId INTEGER PRIMARY KEY REFERENCES Task(Id) ON DELETE CASCADE,
    JiraKey TEXT NOT NULL UNIQUE,
    JiraUrl TEXT NULL,
    OpenCount INTEGER NOT NULL DEFAULT 0,
    LastSeenAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS TaskChecklistItem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskId INTEGER NOT NULL REFERENCES Task(Id) ON DELETE CASCADE,
    Title TEXT NOT NULL,
    IsDone INTEGER NOT NULL DEFAULT 0,
    SortOrder INTEGER NOT NULL DEFAULT 0,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    DoneAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS TaskTimelineEntry (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskId INTEGER NOT NULL REFERENCES Task(Id) ON DELETE CASCADE,
    Note TEXT NOT NULL,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    DeletedAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS DailyLog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    LogDate TEXT NOT NULL UNIQUE,
    Note TEXT NOT NULL,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    DeletedAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS WorkLogEntry (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Description TEXT NOT NULL,
    DurationMinutes INTEGER NOT NULL DEFAULT 15,
    Source TEXT NOT NULL CHECK (Source IN ('Timer','Extension','Manual','Break')) DEFAULT 'Manual',
    TaskId INTEGER NULL,
    ProblemId INTEGER NULL,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    DeletedAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS Problem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Status TEXT NOT NULL CHECK (Status IN ('Exploring','Chosen','Validated')) DEFAULT 'Exploring',
    NoTimeNote TEXT NULL,
    InfiniteTimeNote TEXT NULL,
    ChosenOptionId INTEGER NULL,
    PremortemSign TEXT NULL,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UpdatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    DeletedAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS ProblemOption (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProblemId INTEGER NOT NULL REFERENCES Problem(Id) ON DELETE CASCADE,
    Title TEXT NOT NULL,
    SortOrder INTEGER NOT NULL DEFAULT 0,
    JuniorExplain TEXT NULL,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    DeletedAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS WorkFocus (
    Id INTEGER PRIMARY KEY CHECK (Id = 1),
    Description TEXT NOT NULL DEFAULT '',
    TaskId INTEGER NULL,
    ProblemId INTEGER NULL,
    StartedAt TEXT NULL,
    UpdatedAt TEXT NULL,
    Active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS AppSettings (
    Key TEXT PRIMARY KEY,
    Value TEXT NOT NULL
);

INSERT OR IGNORE INTO AppSettings (Key, Value) VALUES ('PingMinutes', '10');

CREATE INDEX IF NOT EXISTS IX_Task_Status ON Task(Status);
CREATE INDEX IF NOT EXISTS IX_TaskTimelineEntry_TaskId ON TaskTimelineEntry(TaskId);
CREATE INDEX IF NOT EXISTS IX_WorkLogEntry_CreatedAt ON WorkLogEntry(CreatedAt);
CREATE INDEX IF NOT EXISTS IX_WorkLogEntry_TaskId ON WorkLogEntry(TaskId);
CREATE INDEX IF NOT EXISTS IX_WorkLogEntry_ProblemId ON WorkLogEntry(ProblemId);
CREATE INDEX IF NOT EXISTS IX_Problem_Status ON Problem(Status);
CREATE INDEX IF NOT EXISTS IX_ProblemOption_ProblemId ON ProblemOption(ProblemId);
CREATE INDEX IF NOT EXISTS IX_TaskChecklistItem_TaskId ON TaskChecklistItem(TaskId);
CREATE INDEX IF NOT EXISTS IX_TaskJira_JiraKey ON TaskJira(JiraKey);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Task (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Status TEXT NOT NULL CHECK (Status IN ('Open','Doing','Stuck','Done')) DEFAULT 'Open',
    EnergyType TEXT NOT NULL CHECK (EnergyType IN ('Deep','Light')) DEFAULT 'Light',
    Tags TEXT NULL,
    StuckReason TEXT NULL,
    Pinned INTEGER NOT NULL DEFAULT 0,
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
    LastSeenAt TEXT NULL,
    AssigneeName TEXT NULL,
    AssigneeDisplay TEXT NULL
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
    Status TEXT NOT NULL CHECK (Status IN ('Open','Monitoring','Resolved')) DEFAULT 'Open',
    NoTimeNote TEXT NULL,
    InfiniteTimeNote TEXT NULL,
    ChosenOptionId INTEGER NULL,
    PremortemSign TEXT NULL,
    ExpectedBehavior TEXT NULL,
    ActualBehavior TEXT NULL,
    RootCause TEXT NULL,
    DetectionGap TEXT NULL,
    AffectedPopulation TEXT NULL,
    Resolution TEXT NULL,
    Recovery TEXT NULL,
    ValidationNote TEXT NULL,
    Prevention TEXT NULL,
    ImpactBranches TEXT NULL,
    ImpactCustomers TEXT NULL,
    ImpactRecords TEXT NULL,
    ImpactServices TEXT NULL,
    ImpactSupport TEXT NULL,
    ImpactBusiness TEXT NULL,
    StartedAt TEXT NULL,
    FirstAffectedAt TEXT NULL,
    DetectedAt TEXT NULL,
    RootCauseFoundAt TEXT NULL,
    FixedAt TEXT NULL,
    RecoveryCompletedAt TEXT NULL,
    CostTechnical TEXT NULL,
    CostOperational TEXT NULL,
    CostBusiness TEXT NULL,
    CostOpportunity TEXT NULL,
    SectionSavedAt TEXT NULL,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UpdatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    DeletedAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS ProblemAction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProblemId INTEGER NOT NULL REFERENCES Problem(Id) ON DELETE CASCADE,
    Title TEXT NOT NULL,
    Owner TEXT NULL,
    Deadline TEXT NULL,
    Status TEXT NOT NULL CHECK (Status IN ('Open','Done')) DEFAULT 'Open',
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UpdatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS TaskProblem (
    TaskId INTEGER NOT NULL REFERENCES Task(Id) ON DELETE CASCADE,
    ProblemId INTEGER NOT NULL REFERENCES Problem(Id) ON DELETE CASCADE,
    CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (TaskId, ProblemId)
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
CREATE INDEX IF NOT EXISTS IX_ProblemAction_ProblemId ON ProblemAction(ProblemId);
CREATE INDEX IF NOT EXISTS IX_TaskProblem_ProblemId ON TaskProblem(ProblemId);
CREATE INDEX IF NOT EXISTS IX_TaskProblem_TaskId ON TaskProblem(TaskId);
CREATE INDEX IF NOT EXISTS IX_TaskChecklistItem_TaskId ON TaskChecklistItem(TaskId);
CREATE INDEX IF NOT EXISTS IX_TaskJira_JiraKey ON TaskJira(JiraKey);

CREATE TABLE IF NOT EXISTS JiraCommentInbox (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskId INTEGER NOT NULL,
    JiraKey TEXT NOT NULL,
    CommentId TEXT NOT NULL,
    AuthorName TEXT NOT NULL,
    Body TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    SeenAt TEXT NULL,
    ReceivedAt TEXT NOT NULL,
    UNIQUE (JiraKey, CommentId)
);

CREATE INDEX IF NOT EXISTS IX_JiraCommentInbox_SeenAt ON JiraCommentInbox(SeenAt);
CREATE INDEX IF NOT EXISTS IX_JiraCommentInbox_TaskId ON JiraCommentInbox(TaskId);

using Microsoft.Data.Sqlite;

namespace TaskOS.Api.Data;

public sealed class DatabaseInitializer
{
    private static readonly (string Table, string Column, string Type)[] ExtraColumns =
    [
        ("Task", "DeletedAt", "TEXT NULL"),
        ("TaskTimelineEntry", "DeletedAt", "TEXT NULL"),
        ("DailyLog", "DeletedAt", "TEXT NULL"),
        ("WorkLogEntry", "DeletedAt", "TEXT NULL"),
        ("WorkLogEntry", "TaskId", "INTEGER NULL"),
        ("WorkLogEntry", "ProblemId", "INTEGER NULL"),
        ("Problem", "DeletedAt", "TEXT NULL"),
        ("ProblemOption", "DeletedAt", "TEXT NULL"),
        ("WorkFocus", "ProblemId", "INTEGER NULL"),
        ("Task", "Ownership", "TEXT NOT NULL DEFAULT 'Mine'"),
        ("TaskJira", "Description", "TEXT NULL"),
        ("WorkLogEntry", "JiraWorklogId", "TEXT NULL")
    ];

    private readonly SqliteConnectionFactory _factory;
    private readonly IWebHostEnvironment _environment;

    public DatabaseInitializer(SqliteConnectionFactory factory, IWebHostEnvironment environment)
    {
        _factory = factory;
        _environment = environment;
    }

    public void Initialize()
    {
        var schemaPath = Path.Combine(_environment.ContentRootPath, "Data", "schema.sql");
        if (!File.Exists(schemaPath))
        {
            schemaPath = Path.Combine(AppContext.BaseDirectory, "Data", "schema.sql");
        }

        var schema = File.ReadAllText(schemaPath);
        var lines = schema.Split(['\r', '\n'], StringSplitOptions.None);
        var tablesSql = string.Join('\n', lines.Where(line => !IsIndex(line)));
        var indexSql = string.Join('\n', lines.Where(IsIndex));

        using var connection = _factory.Create();
        Execute(connection, tablesSql);

        foreach (var (table, column, type) in ExtraColumns)
        {
            EnsureColumn(connection, table, column, type);
        }

        EnsureWorkLogAllowsBreak(connection);
        EnsureTaskJira(connection);
        EnsureJiraCommentInbox(connection);

        if (!string.IsNullOrWhiteSpace(indexSql))
        {
            Execute(connection, indexSql);
        }
    }

    private static bool IsIndex(string line) =>
        line.TrimStart().StartsWith("CREATE INDEX", StringComparison.OrdinalIgnoreCase);

    private static void Execute(SqliteConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    private static void EnsureColumn(SqliteConnection connection, string table, string column, string type)
    {
        using var check = connection.CreateCommand();
        check.CommandText = $"PRAGMA table_info({table})";
        using var reader = check.ExecuteReader();
        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        reader.Close();
        using var alter = connection.CreateCommand();
        alter.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} {type}";
        alter.ExecuteNonQuery();
    }

    private static void EnsureWorkLogAllowsBreak(SqliteConnection connection)
    {
        using var lookup = connection.CreateCommand();
        lookup.CommandText = "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'WorkLogEntry'";
        var sql = lookup.ExecuteScalar() as string ?? string.Empty;
        if (sql.Contains("'Break'", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        Execute(connection, """
            CREATE TABLE WorkLogEntry_mig (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Description TEXT NOT NULL,
                DurationMinutes INTEGER NOT NULL DEFAULT 15,
                Source TEXT NOT NULL CHECK (Source IN ('Timer','Extension','Manual','Break')) DEFAULT 'Manual',
                TaskId INTEGER NULL,
                ProblemId INTEGER NULL,
                CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
                DeletedAt TEXT NULL
            );
            INSERT INTO WorkLogEntry_mig (Id, Description, DurationMinutes, Source, TaskId, ProblemId, CreatedAt, DeletedAt)
            SELECT Id, Description, DurationMinutes, Source, TaskId, ProblemId, CreatedAt, DeletedAt FROM WorkLogEntry;
            DROP TABLE WorkLogEntry;
            ALTER TABLE WorkLogEntry_mig RENAME TO WorkLogEntry;
            """);
    }

    private static void EnsureTaskJira(SqliteConnection connection)
    {
        using var lookup = connection.CreateCommand();
        lookup.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'TaskJira'";
        if (lookup.ExecuteScalar() is string)
        {
            return;
        }

        Execute(connection, """
            CREATE TABLE IF NOT EXISTS TaskJira (
                TaskId INTEGER PRIMARY KEY REFERENCES Task(Id) ON DELETE CASCADE,
                JiraKey TEXT NOT NULL UNIQUE,
                JiraUrl TEXT NULL,
                OpenCount INTEGER NOT NULL DEFAULT 0,
                LastSeenAt TEXT NULL
            );
            """);
    }

    private static void EnsureJiraCommentInbox(SqliteConnection connection)
    {
        using var lookup = connection.CreateCommand();
        lookup.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'JiraCommentInbox'";
        if (lookup.ExecuteScalar() is string)
        {
            return;
        }

        Execute(connection, """
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
            """);
    }
}
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
        ("WorkFocus", "ProblemId", "INTEGER NULL")
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
}

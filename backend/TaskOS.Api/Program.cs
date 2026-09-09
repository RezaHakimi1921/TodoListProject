using System.Net.Http.Headers;
using TaskOS.Api.Data;
using TaskOS.Api.Repositories;
using TaskOS.Api.Services;

AppDomain.CurrentDomain.UnhandledException += (_, e) =>
{
    try
    {
        File.AppendAllText(
            Path.Combine(AppContext.BaseDirectory, "crash.log"),
            DateTime.UtcNow.ToString("o") + " " + e.ExceptionObject + Environment.NewLine);
    }
    catch
    {
        // ignore
    }
};

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
if (!args.Any(argument => argument.Contains("urls", StringComparison.OrdinalIgnoreCase)))
{
    builder.WebHost.UseUrls("http://127.0.0.1:5088", "http://[::1]:5088");
}

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});
builder.Services.AddHttpClient<IJiraRestClient, JiraRestClient>((sp, client) =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var baseUrl = (configuration["Jira:BaseUrl"] ?? "https://jira.smartx.ir").Trim().TrimEnd('/');
    client.BaseAddress = new Uri(baseUrl + "/");
    client.Timeout = TimeSpan.FromSeconds(20);
    var token = configuration["Jira:PersonalAccessToken"]?.Trim();
    if (!string.IsNullOrEmpty(token))
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }
    client.DefaultRequestHeaders.TryAddWithoutValidation("X-Atlassian-Token", "no-check");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});

var sqlite = builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=taskos.db";
builder.Services.AddSingleton(new SqliteConnectionFactory(sqlite));
builder.Services.AddSingleton<DatabaseInitializer>();
builder.Services.AddScoped<ITaskRepository, TaskRepository>();
builder.Services.AddScoped<ITaskJiraRepository, TaskJiraRepository>();
builder.Services.AddScoped<ITaskChecklistRepository, TaskChecklistRepository>();
builder.Services.AddScoped<IDailyLogRepository, DailyLogRepository>();
builder.Services.AddScoped<IWorkLogRepository, WorkLogRepository>();
builder.Services.AddScoped<IProblemRepository, ProblemRepository>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddScoped<IJiraLinkService, JiraLinkService>();
builder.Services.AddScoped<ITaskChecklistService, TaskChecklistService>();
builder.Services.AddScoped<IDailyLogService, DailyLogService>();
builder.Services.AddScoped<IWorkLogService, WorkLogService>();
builder.Services.AddScoped<IProblemService, ProblemService>();
builder.Services.AddScoped<ITrashService, TrashService>();
builder.Services.AddScoped<IFocusService, FocusService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddScoped<IWorkPingService, WorkPingService>();
builder.Services.AddSingleton<IJiraWatchService, JiraWatchService>();
builder.Services.AddScoped<IJiraCommentInboxRepository, JiraCommentInboxRepository>();
builder.Services.AddScoped<IJiraCommentInboxService, JiraCommentInboxService>();
builder.Services.AddScoped<JiraDoneCommentService>();
builder.Services.AddHostedService<WorkPingHostedService>();
builder.Services.AddHostedService<IncomingPsSyncHostedService>();
builder.Services.AddHostedService<JiraWatchHostedService>();
builder.Services.AddHostedService<JiraDoneCommentHostedService>();

var app = builder.Build();
app.Services.GetRequiredService<DatabaseInitializer>().Initialize();
try
{
    StartupInstaller.Ensure(app.Environment.ContentRootPath);
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Could not install Windows startup shortcut");
}
app.UseCors();
app.MapGet("/", () => Results.Content(
    """
    <!doctype html>
    <html lang="fa" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>TaskOS API</title>
      </head>
      <body style="font-family:Tahoma,sans-serif;background:#12110e;color:#f4efe4;padding:40px">
        <h1>TaskOS API روشن است</h1>
        <p>این پورت خود سرویس است، نه صفحهٔ کارها.</p>
        <p><a href="http://127.0.0.1:5173" style="color:#d97706">باز کردن رابط کاربری</a></p>
        <p><a href="/api/health" style="color:#d97706">/api/health</a> · <a href="/api/settings" style="color:#d97706">/api/settings</a></p>
      </body>
    </html>
    """,
    "text/html; charset=utf-8"));
app.MapGet("/api/health", () => Results.Ok(new { ok = true, api = "http://127.0.0.1:5088" }));
app.MapControllers();
app.Run();

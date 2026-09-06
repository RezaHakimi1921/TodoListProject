using TaskOS.Api.Data;
using TaskOS.Api.Repositories;
using TaskOS.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var sqlite = builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=taskos.db";
builder.Services.AddSingleton(new SqliteConnectionFactory(sqlite));
builder.Services.AddSingleton<DatabaseInitializer>();
builder.Services.AddScoped<ITaskRepository, TaskRepository>();
builder.Services.AddScoped<IDailyLogRepository, DailyLogRepository>();
builder.Services.AddScoped<IWorkLogRepository, WorkLogRepository>();
builder.Services.AddScoped<IProblemRepository, ProblemRepository>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddScoped<IDailyLogService, DailyLogService>();
builder.Services.AddScoped<IWorkLogService, WorkLogService>();
builder.Services.AddScoped<IProblemService, ProblemService>();
builder.Services.AddScoped<ITrashService, TrashService>();
builder.Services.AddScoped<IFocusService, FocusService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddScoped<IWorkPingService, WorkPingService>();
builder.Services.AddHostedService<WorkPingHostedService>();

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
app.MapControllers();
app.Run();

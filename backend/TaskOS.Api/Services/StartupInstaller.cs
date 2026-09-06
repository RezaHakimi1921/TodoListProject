namespace TaskOS.Api.Services;

public static class StartupInstaller
{
    public static void Ensure(string contentRoot)
    {
        var api = Path.GetFullPath(contentRoot);
        var repo = Path.GetFullPath(Path.Combine(api, "..", ".."));
        var frontend = Path.Combine(repo, "frontend");
        const string node = @"C:\nvm4w\nodejs";

        var script =
            "@echo off" + Environment.NewLine +
            "chcp 65001 >nul" + Environment.NewLine +
            "netstat -ano | findstr \":5088\" | findstr LISTENING >nul" + Environment.NewLine +
            "if not errorlevel 1 goto ui" + Environment.NewLine +
            $"cd /d \"{api}\"" + Environment.NewLine +
            "start \"TaskOS API\" /MIN dotnet run --urls http://localhost:5088" + Environment.NewLine +
            ":ui" + Environment.NewLine +
            "netstat -ano | findstr \":5173\" | findstr LISTENING >nul" + Environment.NewLine +
            "if not errorlevel 1 exit /b 0" + Environment.NewLine +
            $"if not exist \"{node}\\npx.cmd\" exit /b 0" + Environment.NewLine +
            $"cd /d \"{frontend}\"" + Environment.NewLine +
            $"set PATH={node};%PATH%" + Environment.NewLine +
            "start \"TaskOS UI\" /MIN npx vite --port 5173 --host 127.0.0.1" + Environment.NewLine;

        File.WriteAllText(Path.Combine(repo, "start-on-boot.bat"), script);
        var dest = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "TaskOS.bat");
        File.WriteAllText(dest, script);
    }
}

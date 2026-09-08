namespace TaskOS.Api.Services;

public static class StartupInstaller
{
    public static void Ensure(string contentRoot)
    {
        var api = Path.GetFullPath(contentRoot);
        var repo = Path.GetFullPath(Path.Combine(api, "..", ".."));
        var frontend = Path.Combine(repo, "frontend");
        var exe = Path.Combine(api, "bin", "Debug", "net9.0-windows10.0.19041.0", "TaskOS.Api.exe");
        const string node = @"C:\nvm4w\nodejs";

        var script =
            "@echo off" + Environment.NewLine +
            "chcp 65001 >nul" + Environment.NewLine +
            "setlocal" + Environment.NewLine +
            $"cd /d \"{repo}\"" + Environment.NewLine +
            $"set \"API_DIR={api}\"" + Environment.NewLine +
            $"set \"API_EXE={exe}\"" + Environment.NewLine +
            $"set \"UI_DIR={frontend}\"" + Environment.NewLine +
            $"set \"NODE={node}\"" + Environment.NewLine +
            "netstat -ano | findstr \":5088\" | findstr LISTENING >nul" + Environment.NewLine +
            "if not errorlevel 1 goto ui" + Environment.NewLine +
            "if exist \"%API_EXE%\" (" + Environment.NewLine +
            "  start \"TaskOS API\" /MIN /D \"%API_DIR%\" \"%API_EXE%\" --urls http://127.0.0.1:5088" + Environment.NewLine +
            ") else (" + Environment.NewLine +
            "  cd /d \"%API_DIR%\"" + Environment.NewLine +
            "  start \"TaskOS API\" /MIN dotnet run --urls http://127.0.0.1:5088" + Environment.NewLine +
            ")" + Environment.NewLine +
            ":ui" + Environment.NewLine +
            "netstat -ano | findstr \":5173\" | findstr LISTENING >nul" + Environment.NewLine +
            "if not errorlevel 1 goto wait" + Environment.NewLine +
            $"if not exist \"{node}\\npx.cmd\" goto wait" + Environment.NewLine +
            "cd /d \"%UI_DIR%\"" + Environment.NewLine +
            "set \"PATH=%NODE%;%PATH%\"" + Environment.NewLine +
            "start \"TaskOS UI\" /MIN npx vite --port 5173 --host 127.0.0.1" + Environment.NewLine +
            ":wait" + Environment.NewLine +
            "set /a n=0" + Environment.NewLine +
            ":waitapi" + Environment.NewLine +
            "netstat -ano | findstr \":5088\" | findstr LISTENING >nul" + Environment.NewLine +
            "if not errorlevel 1 goto waitui" + Environment.NewLine +
            "set /a n+=1" + Environment.NewLine +
            "if %n% GEQ 40 goto open" + Environment.NewLine +
            "timeout /t 1 /nobreak >nul" + Environment.NewLine +
            "goto waitapi" + Environment.NewLine +
            ":waitui" + Environment.NewLine +
            "set /a n=0" + Environment.NewLine +
            ":waitui2" + Environment.NewLine +
            "netstat -ano | findstr \":5173\" | findstr LISTENING >nul" + Environment.NewLine +
            "if not errorlevel 1 goto open" + Environment.NewLine +
            "set /a n+=1" + Environment.NewLine +
            "if %n% GEQ 40 goto open" + Environment.NewLine +
            "timeout /t 1 /nobreak >nul" + Environment.NewLine +
            "goto waitui2" + Environment.NewLine +
            ":open" + Environment.NewLine +
            "start \"\" \"http://127.0.0.1:5173/\"" + Environment.NewLine;

        File.WriteAllText(Path.Combine(repo, "start-taskos.bat"), script);
        File.WriteAllText(Path.Combine(repo, "start-on-boot.bat"), script);
        var dest = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "TaskOS.bat");
        File.WriteAllText(dest, script);
    }
}

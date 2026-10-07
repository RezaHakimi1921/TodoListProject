@echo off
chcp 65001 >nul
setlocal
cd /d "F:\Smart Drivers\TodoListProject"
set "API_DIR=F:\Smart Drivers\TodoListProject\backend\TaskOS.Api"
set "API_EXE=F:\Smart Drivers\TodoListProject\backend\TaskOS.Api\bin\Debug\net9.0-windows10.0.19041.0\TaskOS.Api.exe"
set "PUSH_EXE=F:\Smart Drivers\TodoListProject\backend\TaskOS.Api\bin\push\TaskOS.Api.exe"
set "UI_DIR=F:\Smart Drivers\TodoListProject\frontend"
set "NODE=C:\nvm4w\nodejs"
netstat -ano | findstr ":5088" | findstr LISTENING >nul
if not errorlevel 1 goto push
if exist "%API_EXE%" (
  start "TaskOS API" /MIN /D "%API_DIR%" "%API_EXE%" --urls http://127.0.0.1:5088
) else (
  cd /d "%API_DIR%"
  start "TaskOS API" /MIN dotnet run --urls http://127.0.0.1:5088
)
:push
netstat -ano | findstr ":5108" | findstr LISTENING >nul
if not errorlevel 1 goto ui
if exist "%PUSH_EXE%" (
  start "TaskOS Push" /MIN /D "%API_DIR%" "%PUSH_EXE%" --urls http://127.0.0.1:5108 --push-only
) else (
  cd /d "%API_DIR%"
  start "TaskOS Push" /MIN dotnet run --urls http://127.0.0.1:5108 --push-only
)
:ui
netstat -ano | findstr ":5173" | findstr LISTENING >nul
if not errorlevel 1 goto wait
if not exist "C:\nvm4w\nodejs\npx.cmd" goto wait
cd /d "%UI_DIR%"
set "PATH=%NODE%;%PATH%"
start "TaskOS UI" /MIN npx vite --port 5173 --host 0.0.0.0
:wait
set /a n=0
:waitapi
netstat -ano | findstr ":5088" | findstr LISTENING >nul
if not errorlevel 1 goto waitui
set /a n+=1
if %n% GEQ 40 goto open
timeout /t 1 /nobreak >nul
goto waitapi
:waitui
set /a n=0
:waitui2
netstat -ano | findstr ":5173" | findstr LISTENING >nul
if not errorlevel 1 goto open
set /a n+=1
if %n% GEQ 40 goto open
timeout /t 1 /nobreak >nul
goto waitui2
:open
start "" "http://127.0.0.1:5173/"

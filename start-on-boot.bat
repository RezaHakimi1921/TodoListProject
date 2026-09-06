@echo off
chcp 65001 >nul
netstat -ano | findstr ":5088" | findstr LISTENING >nul
if not errorlevel 1 goto ui
cd /d "E:\TodoListProject\backend\TaskOS.Api"
start "TaskOS API" /MIN dotnet run --urls http://localhost:5088
:ui
netstat -ano | findstr ":5173" | findstr LISTENING >nul
if not errorlevel 1 exit /b 0
if not exist "C:\nvm4w\nodejs\npx.cmd" exit /b 0
cd /d "E:\TodoListProject\frontend"
set PATH=C:\nvm4w\nodejs;%PATH%
start "TaskOS UI" /MIN npx vite --port 5173 --host 127.0.0.1

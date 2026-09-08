@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "API_DIR=E:\TodoListProject\backend\TaskOS.Api"
set "API_EXE=%API_DIR%\bin\Debug\net9.0-windows10.0.19041.0\TaskOS.Api.exe"
set "UI_DIR=E:\TodoListProject\frontend"
set "NODE=C:\nvm4w\nodejs"

netstat -ano | findstr ":5088" | findstr LISTENING >nul
if not errorlevel 1 goto ui
if exist "%API_EXE%" (
  start "TaskOS API" /MIN /D "%API_DIR%" "%API_EXE%" --urls http://127.0.0.1:5088
) else (
  cd /d "%API_DIR%"
  start "TaskOS API" /MIN dotnet run --urls http://127.0.0.1:5088
)

:ui
netstat -ano | findstr ":5173" | findstr LISTENING >nul
if not errorlevel 1 goto wait
if not exist "%NODE%\npx.cmd" goto wait
cd /d "%UI_DIR%"
set "PATH=%NODE%;%PATH%"
start "TaskOS UI" /MIN npx vite --port 5173 --host 127.0.0.1

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

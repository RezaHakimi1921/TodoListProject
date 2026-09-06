@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo TaskOS Chrome extension folder:
echo %cd%
echo.
echo 1) Chrome -> chrome://extensions
echo 2) Developer mode ON
echo 3) Load unpacked -> select THIS folder
echo.
explorer.exe "%cd%"
start "" chrome.exe "chrome://extensions"
pause

@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  Creating Desktop shortcut...
echo.

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-9ruHub-shortcut.ps1"
if errorlevel 1 (
  echo [ERROR] Shortcut creation failed.
  pause
  exit /b 1
)

echo.
pause
endlocal
exit /b 0

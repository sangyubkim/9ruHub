@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title 9ruHub stop
echo.
echo  Stopping 9ruHub local servers...
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo  - kill port 3000 PID %%P
  taskkill /PID %%P /F >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":51218" ^| findstr "LISTENING"') do (
  echo  - kill port 51218 PID %%P
  taskkill /PID %%P /F >nul 2>&1
)

taskkill /FI "WINDOWTITLE eq 9ruHub-Web*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq 9ruHub-DB*" /F >nul 2>&1

echo.
echo  Stop requested.
if /i not "%~1"=="nopause" pause
endlocal
exit /b 0

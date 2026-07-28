@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title 9ruHub launcher
echo.
echo  ========================================
echo   9ruHub local server start
echo  ========================================
echo.

if not exist "package.json" (
  echo [ERROR] package.json not found.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] Installing npm packages...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [0/3] Cleaning up existing servers...
call "%~dp0stop-9ruHub.bat" nopause

echo [1/3] Starting Prisma DB window...
start "9ruHub-DB" /min cmd.exe /k "cd /d ""%~dp0"" && title 9ruHub-DB && npm.cmd run db:dev"

echo [2/3] Waiting for DB port 51218...
set /a _tries=0
:wait_db
set /a _tries+=1
if %_tries% GTR 60 (
  echo [WARN] DB port not ready. Starting web anyway.
  goto start_web
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',51218); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  timeout /t 2 /nobreak >nul
  goto wait_db
)
echo       DB is ready.

:start_web
echo [3/3] Starting Next.js window...
start "9ruHub-Web" cmd.exe /k "cd /d ""%~dp0"" && title 9ruHub-Web && npm.cmd run dev"

timeout /t 4 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo  Done.
echo  - Web: http://localhost:3000
echo  - Close DB/Web windows to stop servers.
echo  - Or run: stop-9ruHub.bat
echo.
pause
endlocal
exit /b 0

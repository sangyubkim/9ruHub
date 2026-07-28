# Creates a Desktop shortcut that launches start-9ruHub.bat (taskbar-pinnable)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat = Join-Path $root "start-9ruHub.bat"
if (-not (Test-Path $bat)) {
  throw "start-9ruHub.bat not found: $bat"
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "9ruHub.lnk"

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnkPath)
# cmd.exe wrapper so Windows allows Pin to taskbar
$s.TargetPath = "$env:SystemRoot\System32\cmd.exe"
$s.Arguments = "/c `"$bat`""
$s.WorkingDirectory = $root
$s.WindowStyle = 1
$s.Description = "9ruHub local server (DB + Next)"
$s.IconLocation = "$env:SystemRoot\System32\shell32.dll,137"
$s.Save()

Write-Host ""
Write-Host "Shortcut created:"
Write-Host "  $lnkPath"
Write-Host ""
Write-Host "Pin to taskbar:"
Write-Host "  1) Right-click Desktop shortcut '9ruHub'"
Write-Host "  2) Choose Pin to taskbar"
Write-Host ""

explorer.exe "/select,$lnkPath"

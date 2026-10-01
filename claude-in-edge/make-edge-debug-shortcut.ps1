<#
.SYNOPSIS
  Creates a desktop shortcut that launches Edge with a remote-debugging port on its own profile.

.DESCRIPTION
  Edge 151 (Chromium 136+) silently ignores --remote-debugging-port when the browser runs on the
  default "User Data" folder. The fix is an explicit, separate --user-data-dir, which this shortcut
  sets. That profile also runs alongside your normal Edge without disturbing it.

  The shortcut is named "Edge (CDP <port>).lnk". An existing shortcut is never overwritten
  unless you pass -Force.

.PARAMETER Port
  Remote debugging port. Default 9222.

.PARAMETER ProfileDir
  Folder for the separate Edge profile. Default %LOCALAPPDATA%\EdgeDebugProfile.
  Must NOT be Edge's default "User Data" folder.

.PARAMETER ShortcutPath
  Where to put the shortcut. Either a full .lnk path or a folder. Default: your Desktop.

.PARAMETER Force
  Overwrite an existing shortcut.

.EXAMPLE
  .\make-edge-debug-shortcut.ps1
  .\make-edge-debug-shortcut.ps1 -Port 9333 -ProfileDir D:\edge-debug
#>
[CmdletBinding()]
param(
    [int]$Port = 9222,
    [string]$ProfileDir = (Join-Path $env:LOCALAPPDATA 'EdgeDebugProfile'),
    [string]$ShortcutPath = [Environment]::GetFolderPath('Desktop'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if ($Port -lt 1024 -or $Port -gt 65535) {
    throw "Port must be between 1024 and 65535 (got $Port)."
}

# Find msedge.exe in both Program Files locations.
$candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
)
$edge = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $edge) {
    throw "Could not find msedge.exe. Looked in:`n  $($candidates -join "`n  ")"
}

# Refuse Edge's own default profile: the port would be ignored there.
$defaultUserData = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'
$resolvedProfile = [IO.Path]::GetFullPath($ProfileDir).TrimEnd('\')
if ($resolvedProfile -ieq $defaultUserData.TrimEnd('\')) {
    throw "ProfileDir is Edge's default User Data folder. Edge ignores the debug port there. Pick a separate folder."
}

# ShortcutPath may be a folder or a full .lnk path.
if ($ShortcutPath -like '*.lnk') {
    $lnk = $ShortcutPath
} else {
    $lnk = Join-Path $ShortcutPath "Edge (CDP $Port).lnk"
}
$lnkDir = Split-Path -Parent $lnk
if ($lnkDir -and -not (Test-Path -LiteralPath $lnkDir)) {
    New-Item -ItemType Directory -Path $lnkDir -Force | Out-Null
}

if ((Test-Path -LiteralPath $lnk) -and -not $Force) {
    Write-Host "A shortcut already exists at:" -ForegroundColor Yellow
    Write-Host "  $lnk"
    Write-Host "Not overwriting. Run again with -Force to replace it."
    exit 1
}

$arguments = "--remote-debugging-port=$Port --remote-allow-origins=* --user-data-dir=`"$resolvedProfile`""

$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($lnk)
$sc.TargetPath = $edge
$sc.Arguments = $arguments
$sc.WorkingDirectory = Split-Path -Parent $edge
$sc.IconLocation = "$edge,0"
$sc.Description = "Edge with remote debugging on port $Port (separate profile)"
$sc.Save()

Write-Host "Created: $lnk" -ForegroundColor Green
Write-Host "  Target:    $edge"
Write-Host "  Arguments: $arguments"
Write-Host ""
Write-Host "Double-click it, then run .\check-cdp.ps1 -Port $Port to confirm the port is open."
Write-Host "Log in to your sites once in that window; the profile remembers them."

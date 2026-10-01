<#
.SYNOPSIS
  Copies your login files from your everyday Edge profile into the debug profile.

.DESCRIPTION
  A fresh debug profile starts logged out of everything. This copies the files that hold logins
  and settings (an allowlist, so cache folders are never touched):

    User Data\Local State
    User Data\<profile>\Network\Cookies
    User Data\<profile>\Login Data
    User Data\<profile>\Preferences
    User Data\<profile>\Secure Preferences
    User Data\<profile>\Web Data
    User Data\<profile>\Bookmarks
    User Data\<profile>\Local Storage
    User Data\<profile>\Session Storage
    User Data\<profile>\IndexedDB

  Safety:
    * Dry run by default. Nothing is copied until you pass -Go.
    * With -Go it refuses to run while ANY msedge.exe is running (the files are locked, and Edge
      flushes cookies to disk when it closes). Close all Edge windows first.
    * It never deletes anything. Existing files in the destination are skipped unless -Overwrite,
      and even then they are replaced, never removed.
    * It never reads or prints the contents of any file. Cookies and saved passwords are copied
      byte for byte as opaque files.

  What to expect: my ChatGPT and Reddit logins carried over; X, Meta Business Suite and TikTok did
  not (they re-authenticate anything that looks like a new browser). Log in to those once by hand
  in the debug window and it persists after that.

  Treat the copied profile like the original: it holds your live sessions. Do not share it.

.PARAMETER SourceRoot
  Edge's User Data folder. Default %LOCALAPPDATA%\Microsoft\Edge\User Data.

.PARAMETER SourceProfile
  Profile folder inside SourceRoot. Default "Default". Others are named "Profile 1", "Profile 2".

.PARAMETER ProfileDir
  The debug profile to seed. Default %LOCALAPPDATA%\EdgeDebugProfile.

.PARAMETER Go
  Actually copy. Without it, only prints what would be copied.

.PARAMETER Overwrite
  Replace files that already exist in the destination. Without it they are skipped.
  Launching the debug Edge once creates its own Preferences and Cookies, so after a first launch
  you need -Overwrite for the seed to take.

.EXAMPLE
  .\seed-profile.ps1            # dry run
  .\seed-profile.ps1 -Go        # copy, with all Edge windows closed
#>
[CmdletBinding()]
param(
    [string]$SourceRoot = (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'),
    [string]$SourceProfile = 'Default',
    [string]$ProfileDir = (Join-Path $env:LOCALAPPDATA 'EdgeDebugProfile'),
    [switch]$Go,
    [switch]$Overwrite
)

$ErrorActionPreference = 'Stop'

$srcRootFull = [IO.Path]::GetFullPath($SourceRoot).TrimEnd('\')
$dstRootFull = [IO.Path]::GetFullPath($ProfileDir).TrimEnd('\')

if ($srcRootFull -ieq $dstRootFull) {
    throw "Source and destination are the same folder. Nothing to do."
}
if (-not (Test-Path -LiteralPath $srcRootFull)) {
    throw "Source not found: $srcRootFull"
}
if (-not (Test-Path -LiteralPath (Join-Path $srcRootFull $SourceProfile))) {
    throw "Profile folder not found: $(Join-Path $srcRootFull $SourceProfile)"
}

# Allowlist. Paths are relative to User Data; the profile name is substituted for the profile
# items. The destination always uses "Default".
$items = @(
    @{ Rel = 'Local State';                      Dest = 'Local State';                      Dir = $false },
    @{ Rel = "$SourceProfile\Network\Cookies";   Dest = 'Default\Network\Cookies';          Dir = $false },
    @{ Rel = "$SourceProfile\Login Data";        Dest = 'Default\Login Data';               Dir = $false },
    @{ Rel = "$SourceProfile\Preferences";       Dest = 'Default\Preferences';              Dir = $false },
    @{ Rel = "$SourceProfile\Secure Preferences"; Dest = 'Default\Secure Preferences';      Dir = $false },
    @{ Rel = "$SourceProfile\Web Data";          Dest = 'Default\Web Data';                 Dir = $false },
    @{ Rel = "$SourceProfile\Bookmarks";         Dest = 'Default\Bookmarks';                Dir = $false },
    @{ Rel = "$SourceProfile\Local Storage";     Dest = 'Default\Local Storage';            Dir = $true  },
    @{ Rel = "$SourceProfile\Session Storage";   Dest = 'Default\Session Storage';          Dir = $true  },
    @{ Rel = "$SourceProfile\IndexedDB";         Dest = 'Default\IndexedDB';                Dir = $true  }
)

function Get-Size([string]$Path, [bool]$IsDir) {
    if ($IsDir) {
        $m = Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum
        return [long]$m.Sum
    }
    return (Get-Item -LiteralPath $Path -Force).Length
}

$edgeRunning = @(Get-Process -Name msedge -ErrorAction SilentlyContinue)

Write-Host ""
if ($Go) { Write-Host "SEED (copying)" -ForegroundColor Cyan } else { Write-Host "DRY RUN (nothing will be copied; pass -Go to copy)" -ForegroundColor Cyan }
Write-Host "  From: $srcRootFull  (profile: $SourceProfile)"
Write-Host "  To:   $dstRootFull"
Write-Host ""

if ($edgeRunning.Count -gt 0) {
    if ($Go) {
        Write-Host "msedge.exe is running ($($edgeRunning.Count) process(es))." -ForegroundColor Red
        Write-Host "Close every Edge window (including the debug one) and run again. Nothing was copied."
        exit 1
    }
    Write-Host "Note: msedge.exe is running right now. -Go would refuse until every Edge window is closed." -ForegroundColor Yellow
    Write-Host ""
}

$total = 0L
$plan = @()
foreach ($it in $items) {
    $src = Join-Path $srcRootFull $it.Rel
    $dst = Join-Path $dstRootFull $it.Dest
    if (-not (Test-Path -LiteralPath $src)) {
        Write-Host ("  missing   {0}" -f $it.Rel) -ForegroundColor DarkGray
        continue
    }
    $size = Get-Size $src $it.Dir
    $exists = Test-Path -LiteralPath $dst
    $action = if ($exists -and -not $Overwrite) { 'skip (exists)' } elseif ($exists) { 'overwrite' } else { 'copy' }
    $plan += [pscustomobject]@{ Src = $src; Dst = $dst; Dir = $it.Dir; Action = $action; Size = $size; Rel = $it.Rel }
    Write-Host ("  {0,-14} {1,-34} {2,10:N0} KB" -f $action, $it.Rel, [math]::Round($size / 1KB))
}

$toCopy = @($plan | Where-Object { $_.Action -ne 'skip (exists)' })
$totalKb = [math]::Round((($toCopy | Measure-Object -Property Size -Sum).Sum) / 1KB)
Write-Host ""
Write-Host ("  {0} item(s) would be copied, about {1:N0} KB. Cache folders are never included." -f $toCopy.Count, $totalKb)

if (-not $Go) {
    Write-Host ""
    Write-Host "Dry run only. Close all Edge windows, then re-run with -Go."
    exit 0
}

foreach ($p in $toCopy) {
    $dstParent = Split-Path -Parent $p.Dst
    if (-not (Test-Path -LiteralPath $dstParent)) { New-Item -ItemType Directory -Path $dstParent -Force | Out-Null }
    if ($p.Dir) {
        # robocopy /E never removes anything (no /MIR, no /PURGE). Without -Overwrite, /XC /XN /XO
        # leaves files that already exist untouched.
        $flags = @('/E', '/COPY:DAT', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
        if (-not $Overwrite) { $flags += @('/XC', '/XN', '/XO') }
        & robocopy $p.Src $p.Dst @flags | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $($p.Rel) (exit $LASTEXITCODE)." }
    } else {
        Copy-Item -LiteralPath $p.Src -Destination $p.Dst -Force
    }
    Write-Host ("  copied  {0}" -f $p.Rel) -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Launch the debug Edge shortcut. Expect ChatGPT-style sites to be logged in;"
Write-Host "X, Meta and TikTok usually need one manual login."

<#
.SYNOPSIS
  Checks whether a Chromium/Edge remote-debugging port is listening and lists its tabs.

.DESCRIPTION
  GETs http://127.0.0.1:<port>/json/version and /json/list, prints the browser version and the
  tab count. Uses 127.0.0.1 and bypasses the proxy on purpose: Windows PowerShell 5.1's
  Invoke-RestMethod against "localhost" can hang for minutes (proxy auto-discovery), which looks
  exactly like a dead debug port and is not.

.PARAMETER Port
  Debug port. Default 9222.

.PARAMETER TimeoutSec
  Per-request timeout. Default 5.

.EXAMPLE
  .\check-cdp.ps1
  .\check-cdp.ps1 -Port 9333
#>
[CmdletBinding()]
param(
    [int]$Port = 9222,
    [int]$TimeoutSec = 5
)

function Get-CdpJson([string]$Url, [int]$TimeoutSec) {
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Proxy = $null
    $req.Timeout = $TimeoutSec * 1000
    $req.ReadWriteTimeout = $TimeoutSec * 1000
    $resp = $req.GetResponse()
    try {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        return ($reader.ReadToEnd() | ConvertFrom-Json)
    } finally {
        $resp.Close()
    }
}

$base = "http://127.0.0.1:$Port"

try {
    $version = Get-CdpJson "$base/json/version" $TimeoutSec
} catch {
    Write-Host "Nothing is answering on $base." -ForegroundColor Red
    Write-Host ""
    Write-Host "Things to check:"
    Write-Host "  1. Is the debug Edge running? Launch it from the 'Edge (CDP $Port)' shortcut."
    Write-Host "  2. Does the shortcut carry its own --user-data-dir? Edge 151 silently ignores the"
    Write-Host "     debug port on the default profile. No error, the port just never opens."
    Write-Host "  3. Is a different port in the shortcut than the one you passed here?"
    exit 1
}

Write-Host "Listening on $base" -ForegroundColor Green
Write-Host "  Browser:    $($version.Browser)"
Write-Host "  Protocol:   $($version.'Protocol-Version')"
Write-Host "  User agent: $($version.'User-Agent')"

try {
    $targets = @(Get-CdpJson "$base/json/list" $TimeoutSec)
} catch {
    Write-Host "The port answered /json/version but /json/list failed: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 2
}

$pages = @($targets | Where-Object { $_.type -eq 'page' })
Write-Host "  Tabs:       $($pages.Count) page target(s), $($targets.Count) target(s) in all"
if ($pages.Count -ge 25) {
    Write-Host "  That is a lot of tabs. connectOverCDP can time out; close strays with /json/close/<id>." -ForegroundColor Yellow
}

foreach ($p in $pages) {
    $title = if ($p.title) { $p.title } else { '(no title)' }
    if ($title.Length -gt 50) { $title = $title.Substring(0, 47) + '...' }
    $url = $p.url
    if ($url.Length -gt 70) { $url = $url.Substring(0, 67) + '...' }
    Write-Host ("    {0}  {1}  {2}" -f $p.id, $title, $url)
}

# Serves this folder on http://localhost:8767 so Tableau can load the Garden Petals
# extension. Needs nothing installed: Windows PowerShell only.
# Leave the window open while Tableau is using the chart. Closing it stops the server.
param([int]$Port = 8767)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$trex = Join-Path $root 'garden-petals.trex'

$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host ""
    Write-Host "Port $Port is already in use." -ForegroundColor Yellow
    Write-Host "If the Garden Petals server is already running in another window, you are set: leave it."
    Write-Host "Otherwise close whatever holds the port, or see README.md to pick a different one."
    exit 1
}

$types = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
    '.csv' = 'text/csv; charset=utf-8'; '.trex' = 'application/xml; charset=utf-8'
    '.md' = 'text/plain; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host ""
Write-Host "Garden Petals server is running." -ForegroundColor Green
Write-Host "  Serving : $root"
Write-Host "  Address : http://localhost:$Port/src/index.html"
Write-Host "  Manifest: $trex"
Write-Host ""
Write-Host "In Tableau: Marks card > Viz Extensions > Add Extension > Access Local Viz Extensions,"
Write-Host "then pick the manifest file above. Keep this window open. Ctrl+C to stop."
Write-Host ""

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $res = $ctx.Response
        try {
            $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
            if ($rel -eq '') { $rel = 'src/index.html' }
            $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
            if (-not $path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
                $res.StatusCode = 404
            } else {
                $bytes = [IO.File]::ReadAllBytes($path)
                $ext = [IO.Path]::GetExtension($path).ToLower()
                $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
                $res.Headers.Add('Cache-Control', 'no-store')
                $res.Headers.Add('Access-Control-Allow-Origin', '*')
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            Write-Host ("{0}  {1}  {2}" -f (Get-Date -Format HH:mm:ss), $res.StatusCode, $ctx.Request.Url.AbsolutePath)
        } catch {
            $res.StatusCode = 500
        } finally {
            $res.Close()
        }
    }
} finally {
    $listener.Stop()
}

param([string]$src = "$PSScriptRoot\edge.png", [string]$out = "$PSScriptRoot\grid.png", [int]$step = 100)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile($src)
$g = [System.Drawing.Graphics]::FromImage($img)
$penMinor = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120,255,0,0), 1)
$penMajor = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200,0,255,255), 1)
$font = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Yellow)
$bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180,0,0,0))
for ($x=0; $x -lt $img.Width; $x+=$step) {
  $pen = if ($x % 500 -eq 0) { $penMajor } else { $penMinor }
  $g.DrawLine($pen, $x, 0, $x, $img.Height)
  $g.FillRectangle($bg, $x+1, 2, 34, 15)
  $g.DrawString($x, $font, $brush, $x+1, 1)
}
for ($y=0; $y -lt $img.Height; $y+=$step) {
  $pen = if ($y % 500 -eq 0) { $penMajor } else { $penMinor }
  $g.DrawLine($pen, 0, $y, $img.Width, $y)
  $g.FillRectangle($bg, 2, $y+1, 34, 15)
  $g.DrawString($y, $font, $brush, 2, $y)
}
$g.Dispose()
$img.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
Write-Output "grid -> $out"

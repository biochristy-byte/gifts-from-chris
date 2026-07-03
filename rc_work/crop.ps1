param([int]$x, [int]$y, [int]$w, [int]$h, [double]$scale = 3.0, [string]$src = "$PSScriptRoot\edge.png", [string]$out = "$PSScriptRoot\crop.png")
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($src)
$rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
$crop = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0,0,$w,$h)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$nw = [int]($w * $scale); $nh = [int]($h * $scale)
$big = New-Object System.Drawing.Bitmap($nw, $nh)
$g2 = [System.Drawing.Graphics]::FromImage($big)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($crop, 0, 0, $nw, $nh)
$g2.Dispose()
$big.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose(); $crop.Dispose(); $big.Dispose()
Write-Output "cropped ${w}x${h} -> ${nw}x${nh} $out"

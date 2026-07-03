param(
  [string]$img,
  [string]$text,
  [int]$cx = 1196,   # composer focus x (empty new-chat state)
  [int]$cy = 742,    # composer focus y
  [int]$uploadMs = 6000
)
Add-Type @"
using System;using System.Runtime.InteropServices;
public class AG {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,int dx,int dy,int d,UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, UIntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
"@
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[AG]::SetProcessDPIAware() | Out-Null
$edge=[IntPtr]74123840
function Tap($vk){ [AG]::keybd_event($vk,0,0,[UIntPtr]::Zero); [AG]::keybd_event($vk,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 70 }
function Ctrl($vk){ [AG]::keybd_event(0x11,0,0,[UIntPtr]::Zero); Tap $vk; [AG]::keybd_event(0x11,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 100 }
function Click($x,$y){ [AG]::SetCursorPos($x,$y); Start-Sleep -Milliseconds 140; [AG]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [AG]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 200 }

# bring edge forward
[AG]::ShowWindow($edge,3) | Out-Null; [AG]::BringWindowToTop($edge) | Out-Null; [AG]::SetForegroundWindow($edge) | Out-Null
Start-Sleep -Milliseconds 700

# focus composer
Click $cx $cy
Start-Sleep -Milliseconds 250

# load image onto clipboard and paste as attachment
$bmp = New-Object System.Drawing.Bitmap($img)
[System.Windows.Forms.Clipboard]::SetImage($bmp)
Start-Sleep -Milliseconds 400
Ctrl 0x56     # Ctrl+V -> attach image
Start-Sleep -Milliseconds $uploadMs

# focus stays in composer after image paste; paste the prompt text directly (do NOT click, that hits the thumbnail)
Set-Clipboard -Value $text
Start-Sleep -Milliseconds 300
Ctrl 0x56     # Ctrl+V -> paste prompt text
Start-Sleep -Milliseconds 600
Tap 0x0D      # Enter -> send
Start-Sleep -Milliseconds 1500
$bmp.Dispose()
& "$PSScriptRoot\shot.ps1" | Out-Null
Write-Output ("sent; apartment=" + [System.Threading.Thread]::CurrentThread.GetApartmentState() + " fg=" + [AG]::GetForegroundWindow())

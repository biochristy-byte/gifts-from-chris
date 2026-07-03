param([string]$text, [int]$cx = 1021, [int]$cy = 1425)
Add-Type @"
using System;using System.Runtime.InteropServices;
public class FU {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,int dx,int dy,int d,UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, UIntPtr e);
}
"@
[FU]::SetProcessDPIAware() | Out-Null
$edge=[IntPtr]74123840
function Tap($vk){ [FU]::keybd_event($vk,0,0,[UIntPtr]::Zero); [FU]::keybd_event($vk,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80 }
function Ctrl($vk){ [FU]::keybd_event(0x11,0,0,[UIntPtr]::Zero); Tap $vk; [FU]::keybd_event(0x11,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 100 }
[FU]::ShowWindow($edge,3) | Out-Null; [FU]::BringWindowToTop($edge) | Out-Null; [FU]::SetForegroundWindow($edge) | Out-Null
Start-Sleep -Milliseconds 600
[FU]::SetCursorPos($cx,$cy); Start-Sleep -Milliseconds 150; [FU]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [FU]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 300
Set-Clipboard -Value $text
Start-Sleep -Milliseconds 300
Ctrl 0x56
Start-Sleep -Milliseconds 600
Tap 0x0D
Start-Sleep -Milliseconds 1500
& "$PSScriptRoot\shot.ps1" | Out-Null
Write-Output "followup sent"

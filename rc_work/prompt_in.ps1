param([string]$text, [switch]$send)
Add-Type @"
using System;using System.Runtime.InteropServices;
public class P2 {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,int dx,int dy,int d,UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, UIntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
"@
[P2]::SetProcessDPIAware() | Out-Null
$edge=[IntPtr]74123840
function Tap($vk){ [P2]::keybd_event($vk,0,0,[UIntPtr]::Zero); [P2]::keybd_event($vk,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 60 }
function Ctrl($vk){ [P2]::keybd_event(0x11,0,0,[UIntPtr]::Zero); Tap $vk; [P2]::keybd_event(0x11,0,2,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80 }
[P2]::ShowWindow($edge,3) | Out-Null
[P2]::SetForegroundWindow($edge) | Out-Null
Start-Sleep -Milliseconds 350
# click directly into the ChatGPT composer text box to focus it
[P2]::SetCursorPos(1350,1465); Start-Sleep -Milliseconds 120
[P2]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [P2]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 300
# select all + delete to clear any prior draft
Ctrl 0x41
Tap 0x2E   # Delete
Start-Sleep -Milliseconds 150
# paste prompt
Set-Clipboard -Value $text
Start-Sleep -Milliseconds 250
Ctrl 0x56  # Ctrl+V
Start-Sleep -Milliseconds 500
if ($send) { Tap 0x0D }
Start-Sleep -Milliseconds 800
& "$PSScriptRoot\shot.ps1" | Out-Null
Write-Output ("done send=$send fg=" + [P2]::GetForegroundWindow())

param([int]$iconY, [string]$dest, [int]$iconX = 1291)
Add-Type @"
using System;using System.Runtime.InteropServices;
public class DM {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,int dx,int dy,int d,UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, UIntPtr e);
}
"@
[DM]::SetProcessDPIAware() | Out-Null
[DM]::SetForegroundWindow([IntPtr]74123840) | Out-Null
Start-Sleep -Milliseconds 300
function Click($x,$y){ [DM]::SetCursorPos($x,$y); Start-Sleep -Milliseconds 130; [DM]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [DM]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero) }
Click $iconX $iconY        # share icon
Start-Sleep -Milliseconds 1300
Click 1496 1081            # Download in centered share modal
Start-Sleep -Milliseconds 2000
# Esc to close the share modal
[DM]::keybd_event(0x1B,0,0,[UIntPtr]::Zero); [DM]::keybd_event(0x1B,0,2,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 400
$dl = Get-ChildItem "$env:USERPROFILE\Downloads" -File -Filter "ChatGPT Image*.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($dl -and ((Get-Date) - $dl.LastWriteTime).TotalSeconds -lt 40) {
  if (Test-Path $dest) { Remove-Item $dest -Force }
  Move-Item $dl.FullName $dest -Force
  "MOVED -> " + (Split-Path $dest -Leaf) + " (" + [math]::Round((Get-Item $dest).Length/1KB) + " KB)"
} else { "NO NEW DOWNLOAD - newest: " + $(if($dl){$dl.Name + ' @ ' + $dl.LastWriteTime.ToString('HH:mm:ss')}) }

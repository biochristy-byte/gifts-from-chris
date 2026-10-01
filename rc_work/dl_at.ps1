param([int]$shareX, [int]$shareY, [string]$dest)
Add-Type @"
using System;using System.Runtime.InteropServices;
public class DA {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,int dx,int dy,int d,UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, UIntPtr e);
}
"@
[DA]::SetProcessDPIAware() | Out-Null
$edge=[IntPtr]74123840
[DA]::ShowWindow($edge,3) | Out-Null; [DA]::BringWindowToTop($edge) | Out-Null; [DA]::SetForegroundWindow($edge) | Out-Null
Start-Sleep -Milliseconds 500
function Click($x,$y){ [DA]::SetCursorPos($x,$y); Start-Sleep -Milliseconds 160; [DA]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [DA]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero) }
Click $shareX $shareY
Start-Sleep -Milliseconds 1300
Click 1610 1105            # Download in centered share modal
Start-Sleep -Milliseconds 2300
[DA]::keybd_event(0x1B,0,0,[UIntPtr]::Zero); [DA]::keybd_event(0x1B,0,2,[UIntPtr]::Zero)   # Esc
Start-Sleep -Milliseconds 500
$dl = Get-ChildItem "$env:USERPROFILE\Downloads" -File -Filter "ChatGPT Image*.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($dl -and ((Get-Date) - $dl.LastWriteTime).TotalSeconds -lt 45) {
  python "$PSScriptRoot\normalize.py" latest $dest
} else {
  Write-Output ("NO NEW DL; newest=" + $(if($dl){$dl.Name + ' @ ' + $dl.LastWriteTime.ToString('HH:mm:ss')}))
}

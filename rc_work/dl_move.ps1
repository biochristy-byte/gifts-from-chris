# WARNING: this script clicks real screen coordinates. Never run it blind.
#
# The ChatGPT share sheet is a row of buttons: copy-link, X, LinkedIn, Reddit,
# Download. Download is the RIGHTMOST. An earlier version of this script clicked a
# hardcoded Download coordinate; after a layout change that same spot landed on the
# Reddit button and opened a post-to-Reddit flow.
#
# So the coordinates are NOT built in and there is no default for them. Every run:
#   1. shot.ps1 to capture the share sheet, grid.ps1 to read off exact pixels.
#   2. Confirm the point you are about to click is the Download button and not a
#      social share target.
#   3. Pass it explicitly: -dlX <x> -dlY <y>, plus -confirmed.
# Without -dlX, -dlY and -confirmed the script refuses and clicks nothing.
#
# -iconX / -iconY is the share icon under the image. -hwnd is optional: the window
# handle of your browser (see README), used to bring it to the front first.
param(
  [int]$iconY,
  [string]$dest,
  [int]$iconX = 0,
  [int]$dlX = 0,
  [int]$dlY = 0,
  [long]$hwnd = 0,
  [switch]$confirmed
)
if ($iconX -le 0 -or $iconY -le 0 -or $dlX -le 0 -or $dlY -le 0 -or -not $dest) {
  Write-Output "REFUSED: pass -iconX -iconY -dlX -dlY and -dest explicitly. These are screen-specific and have no defaults. Measure them with shot.ps1 and grid.ps1."
  exit 1
}
if (-not $confirmed) {
  Write-Output "REFUSED: pass -confirmed only after you have screenshotted the share sheet and verified that ($dlX,$dlY) is the Download button and not a social share target."
  exit 1
}
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
if ($hwnd -ne 0) { [DM]::SetForegroundWindow([IntPtr]$hwnd) | Out-Null }
Start-Sleep -Milliseconds 300
function Click($x,$y){ [DM]::SetCursorPos($x,$y); Start-Sleep -Milliseconds 130; [DM]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [DM]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero) }
Click $iconX $iconY        # share icon
Start-Sleep -Milliseconds 1300
Click $dlX $dlY            # Download: RIGHTMOST button. Verified by you, not assumed.
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

param(
  [string]$mode,            # click | dblclick | scroll | paste | key | capture | move | type
  [int]$x = 0, [int]$y = 0,
  [int]$amount = 0,
  [string]$text = "",
  [string]$key = "",        # enter | esc | ctrla | ctrlv | f5 | zoomout | zoomin | zoomreset
  [string]$out = "$PSScriptRoot\edge.png",
  [int]$pre = 250,
  [int]$post = 700,
  [switch]$noFocus
)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class A {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint fl);
  [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,int dx,int dy,int d,UIntPtr e);
  public static void Focus(IntPtr target) {
    keybd_event(0x12,0,0,UIntPtr.Zero); keybd_event(0x12,0,2,UIntPtr.Zero); // ALT tap unlocks foreground
    ShowWindow(target, 3); // SW_SHOWMAXIMIZED : un-hide + maximize
    IntPtr fg = GetForegroundWindow();
    uint pidA; uint tFg = GetWindowThreadProcessId(fg, out pidA);
    uint tThis = GetCurrentThreadId();
    uint pidT; uint tTgt = GetWindowThreadProcessId(target, out pidT);
    AttachThreadInput(tThis, tFg, true);
    AttachThreadInput(tThis, tTgt, true);
    SetWindowPos(target, (IntPtr)(-1), 0,0,0,0, (0x1|0x2|0x40)); // TOPMOST+SHOWWINDOW
    BringWindowToTop(target);
    SetForegroundWindow(target);
    SetFocus(target);
    AttachThreadInput(tThis, tFg, false);
    AttachThreadInput(tThis, tTgt, false);
  }
}
"@
[A]::SetProcessDPIAware() | Out-Null
$edge = [IntPtr]21498586
if (-not $noFocus) { [A]::Focus($edge); Start-Sleep -Milliseconds $pre }

function KeyTap($vk) { [A]::keybd_event($vk,0,0,[UIntPtr]::Zero); [A]::keybd_event($vk,0,2,[UIntPtr]::Zero) }
function CtrlKey($vk) { [A]::keybd_event(0x11,0,0,[UIntPtr]::Zero); KeyTap $vk; [A]::keybd_event(0x11,0,2,[UIntPtr]::Zero) }
function Wheel($n) { for ($i=0;$i -lt [math]::Abs($n);$i++){ $d = if($n -gt 0){120}else{-120}; [A]::mouse_event(0x0800,0,0,$d,[UIntPtr]::Zero); Start-Sleep -Milliseconds 35 } }
function Click($cx,$cy) { [A]::SetCursorPos($cx,$cy); Start-Sleep -Milliseconds 90; [A]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [A]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero) }

switch ($mode) {
  "move"    { [A]::SetCursorPos($x,$y) }
  "click"   { Click $x $y }
  "dblclick"{ Click $x $y; Start-Sleep -Milliseconds 70; [A]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [A]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero) }
  "scroll"  { [A]::SetCursorPos($x,$y); Start-Sleep -Milliseconds 80; Wheel $amount }
  "paste"   { Set-Clipboard -Value $text; Start-Sleep -Milliseconds 200; CtrlKey 0x56 }
  "type"    { foreach($ch in $text.ToCharArray()){ } }  # not used; paste preferred
  "key"     {
      switch ($key) {
        "enter"    { KeyTap 0x0D }
        "esc"      { KeyTap 0x1B }
        "ctrla"    { CtrlKey 0x41 }
        "ctrlv"    { CtrlKey 0x56 }
        "f5"       { KeyTap 0x74 }
        "zoomout"  { CtrlKey 0xBD }
        "zoomin"   { CtrlKey 0xBB }
        "zoomreset"{ CtrlKey 0x30 }
        "end"      { KeyTap 0x23 }
        "ctrlend"  { [A]::keybd_event(0x11,0,0,[UIntPtr]::Zero); KeyTap 0x23; [A]::keybd_event(0x11,0,2,[UIntPtr]::Zero) }
      }
  }
}
Start-Sleep -Milliseconds $post
if (-not $noFocus) { [A]::Focus($edge); Start-Sleep -Milliseconds 200 }
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size)
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("mode=$mode key=$key fg=" + [A]::GetForegroundWindow() + " saved=$out")

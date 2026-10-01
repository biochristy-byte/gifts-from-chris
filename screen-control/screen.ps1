<#
  screen.ps1: drive this machine's screen with coordinates that are actually true.

  THE BUG THIS EXISTS TO PREVENT
  PowerShell starts DPI-unaware. On a 2560x1600 display at 150% scaling, for
  example, Windows lies to an unaware process and reports 1707x1067, then silently scales
  everything it captures and every coordinate it is given. The damage is not that
  clicks miss, though they do. It is that a SCREENSHOT comes back wrong, and a
  screenshot is the instrument used to decide what is on screen. On 09/23/2026 a
  paste into a desktop app landed correctly and the downscaled capture did not
  show it, so it was reported as having failed. A broken instrument does not
  report that it is broken, it reports a confident wrong answer.

  So: this script sets per-monitor DPI awareness before it touches anything, and
  `-Action selftest` proves coordinates are true by a check that can fail, and
  then proves the check can fail by running it again in an unaware child process.

  USAGE
    screen.ps1 -Action selftest
    screen.ps1 -Action info
    screen.ps1 -Action find   -Match chatgpt
    screen.ps1 -Action focus  -ProcId 15144
    screen.ps1 -Action shot   -Out C:\path\shot.png [-MaxWidth 1500] [-ProcId N]
    screen.ps1 -Action click  -X 1442 -Y 1357
    screen.ps1 -Action paste  -Text "..."  |  -FromFile C:\path\prompt.txt
    screen.ps1 -Action type   -Keys "^a"

  Coordinates are REAL screen pixels. A shot taken with -MaxWidth prints the
  scale factor it used, and -Action map converts a coordinate read off that
  scaled image back to real pixels, so there is no mental arithmetic.
#>
param(
  [ValidateSet('info', 'shot', 'click', 'paste', 'type', 'focus', 'find', 'selftest', 'map')]
  [string]$Action = 'info',
  [int]$ProcId = 0,
  [string]$Match = '',
  [string]$Out = '',
  [int]$MaxWidth = 0,
  [int]$X = 0,
  [int]$Y = 0,
  [string]$Text = '',
  [string]$FromFile = '',
  [string]$Keys = '',
  [double]$Scale = 0,
  [switch]$Unaware
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- DPI, first.
# This must run before System.Windows.Forms loads, or the process is already
# pinned to the wrong awareness and nothing below can be trusted.
$null = Add-Type -PassThru -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Scr {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int m);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern uint GetDpiForSystem();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool EnumDisplayDevicesW(string dev, uint i, ref DISPLAY_DEVICE d, uint f);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool EnumDisplaySettingsW(string dev, int mode, ref DEVMODE m);

  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DISPLAY_DEVICE {
    public int cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceString;
    public int StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceKey;
  }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmDeviceName;
    public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
    public int dmFields, dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
    public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmFormName;
    public short dmLogPixels;
    public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
    public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
  }

  // The physical desktop: the union of every display that is attached to the
  // desktop, in real pixels, from each display's current MODE. Display modes are
  // not DPI-virtualized, so this is ground truth for aware and unaware processes
  // alike. Graphics adapters are NOT ground truth: on a laptop with two GPUs the
  // idle one can report a stale mode (3840x2160 with no monitor attached).
  // Returns { width, height, displayCount }.
  public static int[] PhysicalDesktop() {
    int minX = int.MaxValue, minY = int.MaxValue, maxX = int.MinValue, maxY = int.MinValue, n = 0;
    for (uint i = 0; ; i++) {
      var d = new DISPLAY_DEVICE(); d.cb = Marshal.SizeOf(d);
      if (!EnumDisplayDevicesW(null, i, ref d, 0)) break;
      if ((d.StateFlags & 1) == 0) continue; // DISPLAY_DEVICE_ATTACHED_TO_DESKTOP
      var m = new DEVMODE(); m.dmSize = (short)Marshal.SizeOf(m);
      if (!EnumDisplaySettingsW(d.DeviceName, -1, ref m)) continue; // ENUM_CURRENT_SETTINGS
      if (m.dmPelsWidth <= 0 || m.dmPelsHeight <= 0) continue;
      minX = Math.Min(minX, m.dmPositionX); minY = Math.Min(minY, m.dmPositionY);
      maxX = Math.Max(maxX, m.dmPositionX + m.dmPelsWidth); maxY = Math.Max(maxY, m.dmPositionY + m.dmPelsHeight);
      n++;
    }
    if (n == 0) return new int[] { 0, 0, 0 };
    return new int[] { maxX - minX, maxY - minY, n };
  }

  public struct POINT { public int X, Y; }
  public struct RECT { public int Left, Top, Right, Bottom; }
  public const uint LDOWN = 0x0002, LUP = 0x0004;

  // -4 is PER_MONITOR_AWARE_V2, the only mode correct on a mixed-DPI desktop.
  public static string ApplyDpi() {
    try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return "per-monitor-v2"; } catch {}
    try { if (SetProcessDPIAware()) return "system-aware"; } catch {}
    return "unchanged";
  }
  public static string Title(IntPtr h) {
    var sb = new StringBuilder(512); GetWindowTextW(h, sb, 512); return sb.ToString();
  }
  // Windows refuses a foreground steal from a background process unless our
  // input thread is attached to the one that currently owns the foreground.
  public static bool Focus(IntPtr h) {
    if (IsIconic(h)) ShowWindow(h, 9);
    IntPtr fg = GetForegroundWindow();
    uint tFg = GetWindowThreadProcessId(fg, IntPtr.Zero), tMe = GetCurrentThreadId();
    AttachThreadInput(tMe, tFg, true);
    BringWindowToTop(h);
    bool ok = SetForegroundWindow(h);
    AttachThreadInput(tMe, tFg, false);
    return ok;
  }
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(120);
    mouse_event(LDOWN, 0, 0, 0, IntPtr.Zero);
    System.Threading.Thread.Sleep(60);
    mouse_event(LUP, 0, 0, 0, IntPtr.Zero);
  }
}
'@

if (-not $Unaware) { $script:DpiMode = [Scr]::ApplyDpi() } else { $script:DpiMode = 'DELIBERATELY UNAWARE' }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Get-ScreenSize {
  # SM_CXVIRTUALSCREEN 78, SM_CYVIRTUALSCREEN 79
  [pscustomobject]@{ W = [Scr]::GetSystemMetrics(78); H = [Scr]::GetSystemMetrics(79) }
}

function Save-Shot([string]$Path, [int]$Cap, [int]$Pid2) {
  $s = Get-ScreenSize
  $bmp = New-Object System.Drawing.Bitmap($s.W, $s.H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
  $g.Dispose()
  $scale = 1.0
  $final = $bmp
  if ($Cap -gt 0 -and $bmp.Width -gt $Cap) {
    $scale = $bmp.Width / $Cap
    $h = [int]($bmp.Height / $scale)
    $small = New-Object System.Drawing.Bitmap($Cap, $h)
    $g2 = [System.Drawing.Graphics]::FromImage($small)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.DrawImage($bmp, 0, 0, $Cap, $h)
    $g2.Dispose()
    $final = $small
  }
  $final.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $w = $final.Width; $hh = $final.Height
  $final.Dispose(); if ($final -ne $bmp) { $bmp.Dispose() }
  [pscustomobject]@{ Real = "$($s.W)x$($s.H)"; Image = "${w}x${hh}"; Scale = [math]::Round($scale, 4); Path = $Path }
}

switch ($Action) {

  'selftest' {
    $fail = 0
    $s = Get-ScreenSize

    # GROUND TRUTH, from outside the DPI layer. Every check below compares
    # against THIS, never against another Win32 call. The first version of this
    # test compared GetSystemMetrics to the captured bitmap, and both are
    # virtualized by the same factor, so a deliberately broken run still passed.
    # A check that measures a thing against itself always agrees with itself.
    # A later version read Win32_VideoController, which trusted the first GPU in
    # the list: on a two-GPU laptop that was the idle one, reporting a stale
    # 3840x2160 for a 2560x1600 panel, and the selftest went red on a good tool.
    $pd = [Scr]::PhysicalDesktop()
    if ($pd[2] -eq 0) { Write-Output "SCREEN SELFTEST SKIP: no display attached to the desktop reported a mode."; exit 1 }
    $trueW = $pd[0]
    $trueH = $pd[1]

    Write-Output "dpi mode      : $DpiMode"
    Write-Output "ground truth  : ${trueW}x${trueH}  ($($pd[2]) display(s), current display modes, unaffected by DPI awareness)"
    Write-Output "screen metrics: $($s.W)x$($s.H)"

    # CHECK 1: what Win32 tells this process must equal the real display mode.
    $okMetrics = ($s.W -eq $trueW -and $s.H -eq $trueH)
    Write-Output "metrics match : $okMetrics"
    if (-not $okMetrics) { $fail++ }

    # CHECK 2: the captured bitmap must be the real display size. This is the
    # one that matters: a scaled capture is a lying instrument.
    $tmp = Join-Path $env:TEMP "screen-selftest.png"
    $shot = Save-Shot $tmp 0 0
    $okSize = ($shot.Image -eq "${trueW}x${trueH}")
    Write-Output "capture size  : $($shot.Image)   match=$okSize"
    if (-not $okSize) { $fail++ }

    # CHECK 3: cursor round trip to a point that exists only on the REAL screen.
    # Targets come from ground truth, so a virtualized process is asked for a
    # coordinate outside its own bounds, gets clamped, and comes back short.
    $tx = $trueW - 120; $ty = $trueH - 120
    $old = New-Object Scr+POINT
    [void][Scr]::GetCursorPos([ref]$old)
    [void][Scr]::SetCursorPos($tx, $ty)
    Start-Sleep -Milliseconds 150
    $got = New-Object Scr+POINT
    [void][Scr]::GetCursorPos([ref]$got)
    [void][Scr]::SetCursorPos($old.X, $old.Y)
    $dx = [math]::Abs($got.X - $tx); $dy = [math]::Abs($got.Y - $ty)
    $okCur = ($dx -le 2 -and $dy -le 2)
    Write-Output "cursor asked  : $tx,$ty"
    Write-Output "cursor landed : $($got.X),$($got.Y)  drift=$dx,$dy  match=$okCur"
    if (-not $okCur) { $fail++ }

    Remove-Item $tmp -ErrorAction SilentlyContinue

    if ($Unaware) {
      Write-Output ""
      Write-Output "SABOTAGE RUN: $fail of 3 checks failed. It must be 3."
      exit $(if ($fail -eq 3) { 0 } else { 1 })
    }

    if ($fail -ne 0) {
      Write-Output ""
      Write-Output "SCREEN SELFTEST RED: $fail of 3 checks failed."
      exit 1
    }

    Write-Output ""
    Write-Output "SCREEN SELFTEST GREEN: 3 of 3 checks true."
    # At 100% scaling (96 DPI) Windows does not virtualize anything, so an
    # unaware child sees the same true numbers and the sabotage cannot fail.
    # That is not a sleeping test, it is a display with nothing to lie about.
    $sysDpi = 0
    try { $sysDpi = [int][Scr]::GetDpiForSystem() } catch {}
    if ($sysDpi -eq 96) {
      Write-Output "Display scaling is 100% (96 DPI): Windows has no scaling to lie about,"
      Write-Output "so the sabotage run is not applicable here. Set scaling above 100% to run it."
      exit 0
    }
    Write-Output "Now proving those checks can fail, in a DPI-unaware child:"
    Write-Output "----------------------------------------------------------"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Action selftest -Unaware
    $sab = $LASTEXITCODE
    Write-Output "----------------------------------------------------------"
    if ($sab -eq 0) {
      Write-Output "SABOTAGE CONFIRMED: broken DPI awareness fails all 3 checks."
      Write-Output "SCREEN SELFTEST GREEN and falsifiable."
    } else {
      Write-Output "SELFTEST IS ASLEEP: the sabotage run did not fail all 3 checks,"
      Write-Output "so these checks cannot prove anything. Fix the test, not the tool."
      exit 1
    }
  }

  'info' {
    $s = Get-ScreenSize
    $fg = [Scr]::GetForegroundWindow()
    Write-Output "dpi mode  : $DpiMode"
    Write-Output "screen    : $($s.W)x$($s.H)"
    Write-Output "foreground: '$([Scr]::Title($fg))'"
  }

  'find' {
    Get-Process | Where-Object { $_.MainWindowTitle -ne '' -or $_.ProcessName -match $Match } |
      Where-Object { $Match -eq '' -or $_.ProcessName -match $Match -or $_.MainWindowTitle -match $Match } |
      ForEach-Object {
        $r = New-Object Scr+RECT
        if ($_.MainWindowHandle -ne [IntPtr]::Zero) { [void][Scr]::GetWindowRect($_.MainWindowHandle, [ref]$r) }
        "{0,6}  {1,-22} '{2}'  rect {3},{4} {5}x{6}" -f $_.Id, $_.ProcessName, $_.MainWindowTitle,
          $r.Left, $r.Top, ($r.Right - $r.Left), ($r.Bottom - $r.Top)
      }
  }

  'focus' {
    $h = (Get-Process -Id $ProcId).MainWindowHandle
    if ($h -eq [IntPtr]::Zero) { Write-Output "pid $ProcId has no window"; exit 1 }
    [void][Scr]::Focus($h)
    Start-Sleep -Milliseconds 600
    $fg = [Scr]::GetForegroundWindow()
    $r = New-Object Scr+RECT
    [void][Scr]::GetWindowRect($h, [ref]$r)
    Write-Output ("focused '{0}' | match={1} | rect {2},{3} {4}x{5}" -f `
      [Scr]::Title($h), ($fg -eq $h), $r.Left, $r.Top, ($r.Right - $r.Left), ($r.Bottom - $r.Top))
  }

  'shot' {
    if ($Out -eq '') { throw "shot needs -Out" }
    if ($ProcId -gt 0) {
      $h = (Get-Process -Id $ProcId).MainWindowHandle
      [void][Scr]::Focus($h); Start-Sleep -Milliseconds 500
    }
    $r = Save-Shot $Out $MaxWidth 0
    Write-Output ("shot real={0} image={1} scale={2} -> {3}" -f $r.Real, $r.Image, $r.Scale, $r.Path)
    if ($r.Scale -ne 1) {
      Write-Output ("  a point (ix,iy) on this image is ({0} * ix, {0} * iy) on screen." -f $r.Scale)
    }
  }

  'map' {
    if ($Scale -le 0) { throw "map needs -Scale from the shot output" }
    Write-Output ("image {0},{1} -> screen {2},{3}" -f $X, $Y, [int]($X * $Scale), [int]($Y * $Scale))
  }

  'click' {
    [Scr]::Click($X, $Y)
    Start-Sleep -Milliseconds 250
    $p = New-Object Scr+POINT
    [void][Scr]::GetCursorPos([ref]$p)
    Write-Output ("clicked {0},{1} | cursor verified at {2},{3} | foreground '{4}'" -f `
      $X, $Y, $p.X, $p.Y, [Scr]::Title([Scr]::GetForegroundWindow()))
  }

  'paste' {
    $body = if ($FromFile -ne '') { Get-Content -LiteralPath $FromFile -Raw } else { $Text }
    if ($body -eq '') { throw "paste needs -Text or -FromFile" }
    Set-Clipboard -Value $body
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 600
    Write-Output ("pasted {0} chars into '{1}'" -f $body.Length, [Scr]::Title([Scr]::GetForegroundWindow()))
  }

  'type' {
    [System.Windows.Forms.SendKeys]::SendWait($Keys)
    Start-Sleep -Milliseconds 400
    Write-Output ("sent '{0}' to '{1}'" -f $Keys, [Scr]::Title([Scr]::GetForegroundWindow()))
  }
}

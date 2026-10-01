# screen-control: let Claude see and click your screen, with numbers that are true

One PowerShell file that lets Claude take a screenshot, find a window, click,
type and paste on Windows. It is the newer, safer version of `../rc_work/`.

## Why it exists

PowerShell starts "DPI-unaware". If your display scaling is above 100% (most
laptops), Windows quietly lies to it: a 2560x1600 screen at 150% is reported as
1707x1067, screenshots come back shrunk, and clicks land in the wrong place. The
worst part is the screenshot. Claude looks at a shrunk capture, misses something
that is really there, and reports a failure that never happened.

`screen.ps1` switches on real DPI awareness before it does anything else, so every
coordinate and every screenshot is in real pixels.

## Prove it on your machine first

```
powershell -NoProfile -ExecutionPolicy Bypass -File screen.ps1 -Action selftest
```

It checks three things against your real display mode: the screen size Windows
reports, the size of a screenshot, and a cursor round trip (the cursor moves to
the bottom-right corner for a moment and comes back; nothing is clicked). Then it
runs the same checks again with DPI awareness deliberately broken, and those must
all fail. A test that cannot fail proves nothing.

You want to see: `SCREEN SELFTEST GREEN and falsifiable.`
At 100% scaling there is nothing for Windows to lie about, so the broken run is
skipped and it says so.

## Commands

| Command | What it does |
|---|---|
| `-Action selftest` | The proof above. Run it once on any new machine or monitor setup. |
| `-Action info` | Screen size, DPI mode, and the title of the window in front. |
| `-Action find -Match chatgpt` | Lists windows whose title or process matches, with process id and position. |
| `-Action focus -ProcId 1234` | Brings that window to the front and confirms it is really in front. |
| `-Action shot -Out C:\temp\shot.png [-MaxWidth 1500] [-ProcId N]` | Screenshot of the whole desktop. `-MaxWidth` shrinks it so Claude can read it, and prints the scale it used. `-ProcId` brings that window to the front first. |
| `-Action map -X 400 -Y 300 -Scale 1.7067` | Turns a point read off a shrunk screenshot back into real screen pixels. |
| `-Action click -X 1442 -Y 1357` | Clicks at real screen pixels. |
| `-Action paste -Text "..."` or `-FromFile prompt.txt` | Pastes text through the clipboard. |
| `-Action type -Keys "^a"` | Sends keystrokes (SendKeys syntax: `^` is Ctrl). |

## Install

Copy `screen.ps1` anywhere, for example `~/.claude/tools/screen/`, and tell your
Claude where it is. A line like this in your `CLAUDE.md` works:

> To see or click the screen, use `~/.claude/tools/screen/screen.ps1`. Run
> `-Action selftest` first on a new setup. Take a shot before every click and
> check the window title before typing anything.

## Good habits

- Screenshot, then click, then screenshot again to confirm. Never click blind.
- Check which window is in front (`-Action info`) before typing or pasting.
- For anything inside a web browser, driving the browser directly is faster and
  more reliable than clicking pixels. See `../claude-in-edge/`.
- Windows only.

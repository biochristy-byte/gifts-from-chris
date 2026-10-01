# rc_work - screen-control toolkit (drive an on-screen app by screenshot + mouse/keyboard)

Built to drive an already-open, logged-in ChatGPT tab in Edge to generate images and file
them, unattended. The same toolkit works for any GUI automation where there is no API:
screenshot, find the thing, click it. This is the FALLBACK method; prefer the CDP driver
in `../webdrive/cgArtBatch.js` when the browser has its debug port open.

## Canonical scripts (use these)

| Script | What it does |
|---|---|
| `shot.ps1` | DPI-aware full-screen capture of the whole virtual screen to `screen.png`. Calls `SetProcessDPIAware()` first (critical: capture at REAL resolution, not the DPI-scaled size). |
| `crop.ps1` | `-x -y -w -h -scale -src -out`. Crops a region and bicubic-upscales so small UI is readable. |
| `grid.ps1` | `-src -out -step`. Overlays a coordinate grid with labels so exact pixel coords can be read off a screenshot. Use whenever a click target moved. |
| `prompt_in.ps1` | `-text '...' [-send]`. Focuses the browser, clicks the ChatGPT composer box, clears it, pastes the text, optionally taps Enter to send, then screenshots. |
| `dl_move.ps1` | `-iconX -iconY -dlX -dlY -dest '<path>' -confirmed [-hwnd]`. Clicks the image's share icon, clicks Download in the share modal, taps Esc, then moves the newest `ChatGPT Image*.png` from Downloads to `-dest`. **Refuses to run** unless every coordinate is passed explicitly and `-confirmed` is set. See the safety note below. |
| `dl_at.ps1` | Like dl_move but takes explicit share x/y and runs `normalize.py` on the download. |
| `act.ps1` | General multi-mode input tool (click/scroll/paste/key) with a robust window-focus routine. |
| `attach_gen.ps1` / `followup.ps1` | Variants for attaching a reference image / sending a follow-up in the same chat. |
| `normalize.py` | Moves/renames the newest ChatGPT download. |

## FIRST STEP every session: calibrate

Window handles change every session and click coordinates drift with layout and screen
resolution (originals were calibrated on 2560x1600). Before driving anything:

1. **Find the window handles:**
   ```powershell
   Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object Id, ProcessName, MainWindowTitle
   $h = (Get-Process -Id <pid>).MainWindowHandle   # gives the HWND
   ```
2. **Update the hardcoded browser handle** (`$edge=[IntPtr]...`) at the top of
   `prompt_in.ps1`, `dl_at.ps1`, and `act.ps1` to the real one. `dl_move.ps1` takes
   the handle as an optional `-hwnd` argument instead.
3. **Re-verify click coords** with `shot.ps1` + `grid.ps1` before trusting them.

## Coordinates are specific to YOUR screen: measure them, never copy them

Every click target depends on your screen resolution, display scaling, browser window
size and the ChatGPT layout that week. A number that works on one machine lands on a
different button on another. Treat any coordinate you read, including the examples
below, as a sketch of where to look, not a value to type.

How to measure a target:

1. Take a screenshot with `shot.ps1` (it captures at real resolution).
2. Run `grid.ps1` on it to overlay labeled gridlines, and read the pixel position off
   the grid. Use `crop.ps1` to zoom in on small buttons.
3. Pass the measured numbers to the script explicitly. Re-measure whenever the layout
   or window changes.

Rough guide to where things are (the examples were measured on a 2560x1600 screen in
mid-2026 and are not reliable elsewhere):

- Composer text box: lower middle of the page, around (1350, 1465) in the original setup.
- Send: tap Enter after paste (composer must be focused); the round send/stop button sits just to the right of the composer.
- Image share icon: the up-arrow at the image's bottom-right. x is stable, y varies with scroll; find y per image with a bottom-strip crop.
- The share sheet is a row of buttons. **Download is the rightmost one.** The others are social share targets.

### Safety note: the Download click

The old version of `dl_move.ps1` clicked a hardcoded Download position. After a layout
change, that exact spot landed on the **Reddit** share button and opened a post-to-Reddit
flow. A blind click on the wrong share button can start a post to a real account.

So `dl_move.ps1` now has no built-in coordinates. It refuses to do anything unless you
pass `-iconX -iconY -dlX -dlY -dest` and the `-confirmed` switch. The routine every time:

1. Open the share sheet and screenshot it with `shot.ps1`.
2. Use `grid.ps1` to find the Download button, and check it is the one labeled Download
   and not copy-link, X, LinkedIn or Reddit.
3. Run it with your measured numbers:

   ```powershell
   .\dl_move.ps1 -iconX <x> -iconY <y> -dlX <x> -dlY <y> -dest "$env:USERPROFILE\Pictures\out.png" -confirmed
   ```

If you are having an AI agent run this, make it show you the annotated screenshot of the
Download button first.

## Gotchas (learned the hard way)

- **PrintWindow on Edge captures all-black** (GPU compositing). MUST use full-screen
  `CopyFromScreen` with the browser visible/maximized.
- **Direct image download via Invoke-WebRequest = 403** (needs session cookies). Always go
  through the share-icon -> Download button so the browser's own auth is used.
- **A hardcoded click can hit a social share button.** See the safety note above. Measure, confirm, pass explicitly.
- **Clicking the image itself opens an edit/canvas view** that Esc and click-away do NOT
  close; only Ctrl+R (reload) returns to normal chat. Never click the image, only its share icon.
- **SetForegroundWindow often silently fails** (Windows foreground lock). Use the
  AttachThreadInput + ALT-tap + BringWindowToTop + SetForegroundWindow combo (see `act.ps1`'s `Focus()`).
- **Image generation takes ~70-95s.** If your agent cannot sleep in the foreground, use a
  background timer and act on its completion.

## Example master style prompt (lock your own with your Claude)

> Please generate ONE image, portrait 9:16. Glossy candy-casual mobile-game illustration:
> soft rounded inflated-plastic (Pixar-like) look, gentle volumetric lighting, rich
> saturated pastel candy colors, glossy highlights. No text, no characters, no UI. Clean
> uncluttered background composition suitable for a game backdrop. Subject: <scene>.

Vary lighting/time-of-day across a set (day/dusk/night, interior/exterior) so the images
do not feel repetitive.

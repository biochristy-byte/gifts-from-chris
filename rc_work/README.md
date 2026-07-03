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
| `dl_move.ps1` | `-iconY <int> [-iconX] -dest '<path>'`. Clicks the image's share icon, clicks Download in the share modal, taps Esc, then moves the newest `ChatGPT Image*.png` from Downloads to `-dest`. |
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
   `prompt_in.ps1`, `dl_move.ps1`, `dl_at.ps1`, and `act.ps1` to the real one.
3. **Re-verify click coords** with `shot.ps1` + `grid.ps1` before trusting them.

## Reference coordinates (2560x1600, ChatGPT web, mid-2026) - verify, do not trust blindly

- Composer text box: **(1350, 1465)**
- Send: tap Enter after paste (composer must be focused); the round send/stop button sits near (1658, 1459).
- Image share icon (up-arrow at the image's bottom-right): **x ~ 1291**, y varies with scroll; find y per image with a bottom-strip crop.
- "Download" inside the centered share modal: **(1496, 1081)** (modal is centered, so stable).

## Gotchas (learned the hard way)

- **PrintWindow on Edge captures all-black** (GPU compositing). MUST use full-screen
  `CopyFromScreen` with the browser visible/maximized.
- **Direct image download via Invoke-WebRequest = 403** (needs session cookies). Always go
  through the share-icon -> Download button so the browser's own auth is used.
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

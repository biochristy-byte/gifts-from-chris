---
description: Drive my already-open, logged-in ChatGPT tab to generate images and file them (no API; CDP driver preferred, screen control as fallback)
argument-hint: "[what to generate and where to save it, e.g. '3 cozy kitchen scenes -> C:\\pics']"
---

# Generate ChatGPT images by driving the open browser tab

<!-- EDIT THESE TWO PATHS after cloning the Gifts from Chris repo -->
- Toolkit repo location: `C:/path/to/gifts-from-chris/`
- Default save folder: `C:/path/to/your/images/`

I keep a logged-in ChatGPT tab available in Edge/Chrome, launched with
`--remote-debugging-port=9222`. There is no image API in play: Claude drives the real
browser session.

What to generate: **$ARGUMENTS**

## Method 1 (preferred): CDP driver

Use `webdrive/cgArtBatch.js` from the toolkit repo (needs `playwright-core` installed in
that folder). First check the port is live: `curl http://localhost:9222/json/version`.

Per image:
1. Write the prompt to a temp file. Start it with a locked style block so a set feels
   consistent, and the driver auto-prepends "Create a single image." so ChatGPT invokes
   the image tool.
2. `node cgArtBatch.js gen <slug> <styleRefImage> <promptFile>` (or skip the ref attach by
   editing the script if you have no reference image).
3. `node cgArtBatch.js wait` - polls until `img[alt^="Generated image"]` is full-res and
   the Stop button is gone (~70-95s).
4. `node cgArtBatch.js save <outPath>` - downloads through the page so login cookies apply.
5. QA it: actually open and look at the image before filing. Regenerate if it is off.

Notes: it uses ONE background tab and never steals focus, so it is safe while the human is
using the computer. `state` and `shot` subcommands help debug. If `state` shows no composer
or a "Log in" button, the ChatGPT session is logged out: STOP and ask the human to log in.
Never drive a login or 2FA flow.

## Method 2 (fallback): screen control

If the debug port is not open and relaunching the browser is not an option, use the
`rc_work/` toolkit in the repo. Read `rc_work/README.md` first (scripts, gotchas,
calibration). Summary: calibrate window handle + coords each session with
`shot.ps1`/`grid.ps1`, send prompts with `prompt_in.ps1 -send -text '...'`, wait ~80s with
a background timer, then `dl_move.ps1 -iconY <y> -dest <path>`. This method needs the
browser visible in the foreground; warn the human before taking the mouse.

## Always

- One image at a time; verify each send actually started generating (Stop button visible).
- QA every image yourself before filing; report results as a table at the end.
- Vary time-of-day / interior-exterior across a set so it does not feel repetitive.
- Only act on the ChatGPT tab and the files. Do not navigate elsewhere, change settings,
  or touch other tabs.

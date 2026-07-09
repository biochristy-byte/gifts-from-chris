# Gifts from Chris

A working recipe for getting your Claude Code to generate images through YOUR ChatGPT
subscription, with no OpenAI API key. Claude writes the image prompts, drives your
already-logged-in ChatGPT tab in the browser, waits for the render, downloads the image,
and files it wherever you tell it. Chris and her Claude have used this to produce hundreds
of game-art images.

## What is in here

| Folder | What it is |
|---|---|
| `claude-command/chatgpt-images.md` | A slash command for Claude Code. Copy it into `~/.claude/commands/` and you get `/chatgpt-images` in every session. |
| `claude-command/floor.md` | A slash command that makes **Sonnet do the coding and Opus review the diff**, to stretch your Opus weekly limit on Max plans. See "The floor command" below. |
| `webdrive/cgArtBatch.js` | The preferred method: a Playwright script that drives ChatGPT through the browser's debug port (CDP). Reliable, runs in a background tab, does not fight you for the mouse. |
| `rc_work/` | The fallback method: pure screen control (screenshot, find the button, click it). Works when CDP is not available. Has its own README with all the hard-won gotchas. |

## One-time setup (do this once)

1. **Install Claude Code** if you have not: https://claude.com/claude-code
2. **Launch Edge (or Chrome) with the debug port open.** Close the browser fully, then run:

   ```
   msedge.exe --remote-debugging-port=9222
   ```

   Tip: make a shortcut with that flag so it is always on. Verify it worked:
   `curl http://localhost:9222/json/version` should return JSON.
3. **Log into chatgpt.com** in that browser with an account that has image generation
   (Plus or Pro).
4. **Install the driver dependencies.** In the `webdrive` folder: `npm init -y && npm install playwright-core`
5. **Install the slash command.** Copy `claude-command/chatgpt-images.md` to
   `C:\Users\<you>\.claude\commands\chatgpt-images.md`. Edit the paths at the top to
   where you cloned this repo, and set your own filing folders.

## Daily use

Tell your Claude something like:

> /chatgpt-images 3 background scenes for my kitchen remodel moodboard, save them to C:\pics

Claude will write the prompts (ask it to lock a style block first if you want a consistent
set), send each one through your ChatGPT tab, wait ~70-95 seconds per image, QA the result,
download it, and file it. You can walk away.

## How it actually works (so you can debug it)

- **Preferred path (CDP):** `cgArtBatch.js` connects Playwright to the browser you already
  have open (`connectOverCDP` on port 9222). It opens ONE background chatgpt.com tab, types
  into the composer (`#prompt-textarea`), clicks send, polls for an `img[alt^="Generated image"]`
  with real resolution and no Stop button, then downloads it through the page itself so your
  login cookies apply. Your mouse stays yours the whole time.
- **Fallback path (screen control):** the `rc_work` scripts screenshot the screen, overlay a
  coordinate grid, click the composer, paste, click the share icon, click Download. It works,
  but coordinates drift between sessions and it needs the browser visible and in the
  foreground. Read `rc_work/README.md` before using; the gotchas section will save you hours.

## Things that will bite you (short list)

- **Prefix every prompt with "Create a single image."** Otherwise ChatGPT sometimes just
  describes the scene in text.
- Generation takes **70-95 seconds**; batches of 15+ images work fine, one at a time.
- If the composer is missing or a "Log in" button shows, the ChatGPT session expired: log
  back in yourself, then re-run. Claude should never drive a login or 2FA flow.
- The image src is on `chatgpt.com/backend-api/estuary/content...`; direct download outside
  the page returns 403. Always download through the page (the script does this).
- Free ChatGPT accounts have very limited image generation; Plus/Pro is what makes this
  pleasant.

## The floor command (a bonus gift: stretch your Opus weekly limit)

On a Max plan, Opus has a tight, separate weekly cap while Sonnet draws from a much bigger
bucket. `floor.md` turns that into a two-tier "nursing unit": Sonnet is the **floor nurse**
who does the hands-on coding, Opus is the **charge nurse** who only reviews the finished
diff and signs off or bounces it back. Because the heavy file-reading stays inside Sonnet's
own context and never lands in the Opus window, your Opus week goes a lot further.

Install it the same way: copy `claude-command/floor.md` into `~/.claude/commands/`, then
edit the two spots at the top (your project paths, and your own project rules to hand the
floor nurse). Use it like:

> /floor add a confirm-on-delete dialog to the settings page in project-a

The command never commits or pushes on its own; you stay in control of that. For a genuine
head-scratcher, it will tell you to skip the loop and let Opus drive directly.

## Teaching your Claude

Beyond installing the slash command, you can just point Claude at this repo and say
"read the README and cgArtBatch.js, then generate me X." It will figure the rest out.
Two habits worth asking for: have it QA each image (screenshot and actually look) before
filing, and have it keep a consistent style block across a set so the images feel like
one family.

Enjoy. - Chris (and her Claude)

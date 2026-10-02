# Gifts from Chris

I build games with Claude Code, and along the way I ended up making a pile of tools
to get past the annoying parts: a way to generate art through my ChatGPT subscription,
a hook that stops Claude from guessing the date, a set of standing rules that Claude
actually keeps reading, and a few more. Everything here is something I use myself,
cleaned up so you can skip the hard parts and install it in a few minutes. Take what
helps.

## What is in here

| Folder | What it does | Who it is for |
|---|---|---|
| [`claude-rules/`](claude-rules/RULES.md) | My 18 standing rules for Claude, the story behind them, and a blank template to write your own. They are re-injected on every message so they cannot scroll out of memory. | Anyone who is tired of repeating the same instructions to Claude. |
| [`hooks/`](hooks/README.md) | The full hook chain: time stamp, standing rules and a size guard on every message, plus a PreCompact handoff form so compaction does not lose your place. Includes a copy-paste settings.json block. | Anyone with long Claude Code sessions or rules that matter. |
| [`time-hook/`](time-hook/README.md) | A one-line Python script that stamps the real local date and time on every prompt. | Everyone. Claude has no clock and its guess about the date is often months old. |
| [`claude-command/`](claude-command) | Two slash commands. `/chatgpt-images` generates images through your ChatGPT tab. `/floor` has Sonnet do the coding and Opus review the diff, to stretch an Opus weekly limit. | Image makers, and Max plan users who hit the Opus cap. |
| [`claude-skill/tell-tab/`](claude-skill/tell-tab/SKILL.md) | A skill for safely sending a message to a Claude Code session in another Windows Terminal tab, with identity checks so the order never lands in the wrong tab. | People who run several Claude sessions at once on Windows. |
| [`webdrive/`](webdrive/cgArtBatch.js) | A Playwright script that drives ChatGPT through the browser's debug port to generate and download images. The preferred image method. | Anyone using `/chatgpt-images`. |
| [`rc_work/`](rc_work/README.md) | Screen-control scripts (screenshot, find the button, click it) for when the debug port is not available. Has its own list of hard-won gotchas and a safety note. | Anyone automating a GUI that has no API. Windows and PowerShell. |
| [`screen-control/`](screen-control/README.md) | The newer, safer screen tool: one PowerShell file for screenshots, clicks, typing and pasting in real pixels, with a selftest that proves the numbers are true on your display. | Anyone letting Claude see and click their screen on Windows. |
| [`claude-in-edge/`](claude-in-edge/README.md) | How my Claude drives my browser: an Edge shortcut with a debug port on its own profile, Playwright MCP setup, a port checker, a login seeder, and the gotchas that cost me hours. | Anyone who wants Claude working in a browser without taking over the mouse. |
| [`slack-bridge/`](slack-bridge/README.md) | How my collaborators talk to my Claude from Slack: a bot that replies with a real notification, a watcher that wakes Claude when someone writes, and an allowlist so only people you name get through. | Anyone who wants their team, or their phone, talking to their Claude. |
| [`tableau-lollipop/`](tableau-lollipop/README.md) | A lollipop chart viz extension I built for Tableau, with a settings panel. Includes what else you need to run it. | Tableau Desktop users who want a chart Tableau does not ship. |

## Quick install

1. **Install Claude Code** if you have not: https://claude.com/claude-code
2. **Clone or download this repo.** Everything below is copy-and-edit, so there is
   nothing to build.
3. **Pick what you want:**
   - Slash commands: copy the `.md` files from `claude-command/` into `~/.claude/commands/`.
   - Skill: copy `claude-skill/tell-tab/` into `~/.claude/skills/`.
   - Rules, time stamp and handoff: follow [`hooks/README.md`](hooks/README.md). It has
     a complete settings.json block.
   - Browser, screen and Tableau tools: each folder's README walks you through it.
4. **Restart Claude Code** so it picks up the new files.

`~/.claude` is the folder named `.claude` in your home directory. On Windows that is
`C:\Users\<you>\.claude`.

Each folder has its own README with the details. If you would rather not read them,
point your Claude at this repo and say "read the README and set up the parts I want."
It will figure out the rest.

## Friends' gifts

Not mine, but worth having: [github.com/jthack/claude-goal](https://github.com/jthack/claude-goal)
is a `/goal` skill for Claude Code. You set a persistent objective and Claude keeps
working toward it across turns. It is jthack's work and I am only pointing
you to it, so go to the repo for the code, install steps and credit.

---

# Image generation through your ChatGPT subscription

The longer story for `chatgpt-images`, `webdrive` and `rc_work`. This is a working
recipe for getting your Claude Code to generate images through YOUR ChatGPT
subscription, with no OpenAI API key. Claude writes the image prompts, drives your
already-logged-in ChatGPT tab in the browser, waits for the render, downloads the
image, and files it wherever you tell it. I have used it to produce hundreds of
images for my own projects.

## One-time setup (do this once)

1. **Launch Edge (or Chrome) with the debug port open.** Close the browser fully, then run:

   ```
   msedge.exe --remote-debugging-port=9222
   ```

   Tip: make a shortcut with that flag so it is always on. Verify it worked:
   `curl http://localhost:9222/json/version` should return JSON.
2. **Log into chatgpt.com** in that browser with an account that has image generation
   (Plus or Pro).
3. **Install the driver dependencies.** In the `webdrive` folder: `npm init -y && npm install playwright-core`
4. **Install the slash command.** Copy `claude-command/chatgpt-images.md` to
   `C:\Users\<you>\.claude\commands\chatgpt-images.md`. Edit the paths at the top to
   where you cloned this repo, and set your own filing folders.

## Daily use

Tell your Claude something like:

> /chatgpt-images 3 background scenes for my kitchen remodel moodboard, save them to C:\pics

Claude will write the prompts (ask it to lock a style block first if you want a consistent
set), send each one through your ChatGPT tab, wait about 70-95 seconds per image, QA the
result, download it, and file it. You can walk away.

## How it actually works (so you can debug it)

- **Preferred path (CDP):** `cgArtBatch.js` connects Playwright to the browser you already
  have open (`connectOverCDP` on port 9222). It opens ONE background chatgpt.com tab, types
  into the composer (`#prompt-textarea`), clicks send, polls for an `img[alt^="Generated image"]`
  with real resolution and no Stop button, then downloads it through the page itself so your
  login cookies apply. Your mouse stays yours the whole time.
- **Fallback path (screen control):** the `rc_work` scripts screenshot the screen, overlay a
  coordinate grid, click the composer, paste, click the share icon, click Download. It works,
  but coordinates are specific to your screen and drift between sessions, and it needs the
  browser visible and in the foreground. Read `rc_work/README.md` before using; the gotchas
  section and the safety note about the Download click will save you hours.

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

## License

MIT. See [LICENSE](LICENSE).

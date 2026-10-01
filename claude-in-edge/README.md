# Claude in Edge

This is how my Claude drives my browser. I run Edge with a remote-debugging port open on its own
separate profile, and Claude steers it over CDP (the Chrome DevTools Protocol) through Playwright,
or through the Claude in Chrome extension. It never grabs my mouse and keyboard, so I can keep
working while it posts, clicks and reads pages in the background.

## What you need

- Windows 10 or 11
- Microsoft Edge
- Claude Code
- Node.js (for Playwright MCP and for any CDP scripts you write)

## What is in this folder

| File | What it does |
|---|---|
| `make-edge-debug-shortcut.ps1` | Creates a desktop shortcut "Edge (CDP 9222)" that launches Edge with the debug port on its own profile. |
| `check-cdp.ps1` | Asks the port who is there and prints the browser version and tab count. Tells you plainly if nothing is listening. |
| `seed-profile.ps1` | Optional. Copies your logins from your everyday Edge profile into the debug profile. Dry run unless you pass `-Go`. |

## Setup

1. **Make the shortcut.** In PowerShell, from this folder:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\make-edge-debug-shortcut.ps1
   ```

   Options: `-Port 9222`, `-ProfileDir <folder>`, `-ShortcutPath <folder or .lnk>`, `-Force` to
   replace an existing shortcut. The shortcut runs:

   ```
   msedge.exe --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%LOCALAPPDATA%\EdgeDebugProfile"
   ```

2. **Launch it** from your desktop. It opens a separate Edge window with its own profile. It runs
   alongside your normal Edge and does not disturb it.
3. **Check the port:**

   ```powershell
   .\check-cdp.ps1
   ```

   You should see the Edge version and a tab count.
4. **Log in** to the sites you want Claude to use, once, in that window. The profile remembers
   them. Or seed some of them from your everyday profile (see Gotchas, "Logins do not carry over").
5. **Give Claude the browser.** Pick one or both of the options below.

## Two ways Claude drives the browser, and when to use which

### 1. Playwright MCP with its own profile (my default)

Playwright MCP launches Edge itself, headed, on a dedicated profile that is not your everyday one.
Claude gets tools like navigate, snapshot (the page as an accessibility tree), click and type, and
acts on elements by name instead of by pixel position. Logins persist in that profile, so you log
in to each service once inside the window it opens.

Add it to Claude Code (this writes to your user config):

```powershell
claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest --browser msedge --user-data-dir "C:/Users/<you>/.claude-browser-profile"
```

Or paste it into `~/.claude.json` (`C:\Users\<you>\.claude.json`) under `mcpServers`. Forward
slashes in the path, and replace `<you>` with your Windows user name:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest",
        "--browser",
        "msedge",
        "--user-data-dir",
        "C:/Users/<you>/.claude-browser-profile"
      ],
      "env": {}
    }
  }
}
```

Restart Claude Code after adding it; the tools do not appear in a session that was already running.

Do not point `--user-data-dir` at Edge's real `User Data` folder. It cannot launch while your
Edge is open, which is always.

Use this one for anything that needs animation, real input timing, or a screenshot of a moving
frame (games, transitions, canvas work). In my measurement, the same page drew 48 frames in 800 ms
in the Playwright window and 0 in a hidden tab.

### 2. Connect over CDP to the debug Edge

This is for scripts. The debug Edge from the shortcut is already running and already logged in,
and your script attaches to it instead of starting a browser. Good for repeatable jobs that use
your logged-in sessions: posting, downloading, filling forms.

```js
// drive.mjs  (npm i playwright-core, in the folder that holds this file)
import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 60000 });
const context = browser.contexts()[0];
const page = await context.newPage();          // a new tab, leaves your other tabs alone
await page.goto('https://example.com/');
console.log(await page.title());
await page.screenshot({ path: 'C:/temp/example.png' });   // absolute path, see Gotchas
await page.close();
await browser.close();                         // disconnects; the browser stays open
```

Node resolves `node_modules` from the script file's own folder, not from where you run it, so keep
the script next to the `node_modules` that holds Playwright.

Tell Claude the port is open and which script to run, and it can write and run these itself.

### Which one

| You want | Use |
|---|---|
| Quick web task, QA, anything with animation or timing | Playwright MCP |
| A repeatable script that uses sites you are already logged in to | CDP to the debug Edge |
| Reading or clicking in a page you already have open | Claude in Chrome extension |

### The Claude in Chrome extension

The Claude in Chrome extension runs in Edge too: I installed it in Edge and use it there. It
works on the tabs of the browser it is installed in, so it is the right tool when you already have
a page open and want Claude to read or click in the DOM. Two things I learned:

- It cannot open `file://` pages. Serve local files over HTTP (for example `npx serve` or
  `python -m http.server`) and open `http://localhost:...` instead.
- The tab it drives is often not the active tab, and a background tab reports
  `visibilityState: hidden`. Hidden tabs do not paint animation frames, and React Router
  transitions can run without the screen repainting. That is the browser's rule, not a bug in
  your page. For anything that moves, use Playwright. If an extension tab sits there not
  responding, a screenshot of it can wake it.

## Gotchas

- **Edge 151 (Chromium 136+) silently ignores the debug port on the default profile.** I launched
  Edge with `--remote-debugging-port=9222`, and the port stayed closed. No error, no log. This is
  anti cookie-theft hardening. The fix is an explicit, separate `--user-data-dir`, which is the
  whole reason the shortcut sets one. If `check-cdp.ps1` finds nothing, look here first.
- **Logins do not carry over.** A new profile starts logged out. Easiest: log in once by hand in
  the debug window. To seed from your everyday profile instead, close every Edge window, then:

  ```powershell
  .\seed-profile.ps1          # dry run: shows what would be copied
  .\seed-profile.ps1 -Go      # copies it
  ```

  It copies only the login and settings files (cookies, Login Data, Local State, Preferences,
  Local and Session Storage, IndexedDB, bookmarks), skips every cache folder, refuses to run while
  any `msedge.exe` is running, and never deletes anything. Launching the debug Edge once creates
  its own Preferences and Cookies, and the seed skips files that exist, so seed before the first
  launch or add `-Overwrite`. That took my copy from 2.21 GB to 143 MB. In my case ChatGPT and
  Reddit came across; X, Meta Business Suite and TikTok did not (they ask again for anything that
  looks like a new browser), so I logged in to those by hand once. If a script gets a login
  redirect, this is the cause, not CDP. The copied profile holds live sessions: do not share it.
- **A native `alert`, `confirm` or `beforeunload` dialog freezes CDP** until a human dismisses it.
  That tab's renderer is frozen, so Playwright's attach never returns and the tab will not close
  through `/json/close` either. Click the popup away in the debug window, then retry. Have Claude
  avoid triggering them, and the extension freezes on them too.
- **Too many tabs time out `connectOverCDP`.** Playwright attaches to every page target, and 28
  or more tabs (heavy single-page apps especially) stall it. Prune the tabs, and pass
  `{ timeout: 60000 }`. The longer timeout helps tab count, not a dialog.
- **Use `127.0.0.1`, not `localhost`.** In Windows PowerShell 5.1, `Invoke-RestMethod` against
  `http://localhost:9222` can hang for minutes (proxy auto-discovery), which looks exactly like a
  dead port. `check-cdp.ps1` bypasses the proxy, or use `curl.exe -s --max-time 6
  http://127.0.0.1:9222/json/version`.
- **Recover without Playwright.** The raw HTTP API works even when Playwright cannot attach:

  ```powershell
  curl.exe -s http://127.0.0.1:9222/json/list          # every target: id, title, url
  curl.exe -s http://127.0.0.1:9222/json/close/<id>    # close one stray tab
  ```

  Close the strays, then connect again. If it is still jammed, a native dialog is the cause.
- **The extension cannot open `file://`.** Serve over HTTP.
- **Headed Playwright draws frames where a hidden tab does not.** See "Which one" above.
- **Screenshot paths.** A script writes screenshots relative to wherever it was started. Use
  absolute paths, or you may look at a stale file from another folder and decide a working script
  is broken.
- **Closing the debug Edge.** Close the window like a person would. A graceful close also flushes
  cookies to disk, which matters before you seed or copy a profile.
- **The debug port is a master key to that browser.** Anything on your machine that can reach
  `127.0.0.1:9222` can drive every tab in it, and `--remote-allow-origins=*` lets any local page
  open the socket. Keep the debug profile for work you are fine with Claude doing, and do not
  forward the port off your machine.

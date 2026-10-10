# Parallel Browsers: many Claude tabs, one login, zero fights

Every Claude Code tab spawns its own Playwright MCP server. If they all point at one
persistent `--user-data-dir`, Chromium locks that profile to a single process, and the
second tab dies with `Browser is already in use for <dir>, use --isolated to run multiple
instances of the same browser`. This gift fixes it. Each tab gets its own throwaway
browser, seeded with the logins you saved, so six tabs can test at the same time and
none of them waits on another.

## What is in here

| File | What it is |
|---|---|
| `refresh-logins.mjs` | Exports your saved logins to a small storage-state file, keeping only the sites on an allowlist, and sweeps the saved profile to the same list. Backs up the cookie database first. Supports `--dry-run`. |
| `prove-parallel.py` | Launches N real Playwright MCP servers at once, `shared` (the old way) or `isolated` (the fix), and reports how many launched and how many animation frames each one counted. |
| `.gitignore` | Keeps storage-state files, cookie backups and `__pycache__/` out of git. Your logins stay on your machine. |

## Setup (once)

1. **Make the default `playwright` server isolated.** Each tab gets its own in-memory
   browser, seeded with the cookies in the storage-state file:

   ```powershell
   claude mcp add playwright -s user -- npx -y @playwright/mcp@latest --browser msedge --isolated --storage-state C:/Users/<you>/.claude/pw-storage-state.json
   ```

2. **Add a second server, `playwright-profile`,** with the persistent profile. Use it one
   tab at a time, only to log into a new site:

   ```powershell
   claude mcp add playwright-profile -s user -- npx -y @playwright/mcp@latest --browser msedge --user-data-dir C:/Users/<you>/.claude-browser-profile
   ```

3. **Restart every Claude Code tab that is already open.** MCP changes are only picked up
   by new sessions.
4. **Edit the allowlist.** Open `refresh-logins.mjs` and replace the `KEEP` list with the
   sites you actually log into. Anything not on the list is dropped.
5. **First login.** In one tab, ask Claude to use `playwright-profile` and log in to a
   site yourself. Close that browser, then see what would be kept:

   ```
   node parallel-browsers/refresh-logins.mjs --dry-run
   ```

   When the line looks right, run it for real (no flag):

   ```
   node parallel-browsers/refresh-logins.mjs
   ```

   It writes `C:\Users\<you>\.claude\pw-storage-state.json`. New tabs start from it.
   Repeat step 5 whenever you add a site.

The script reads `@playwright/mcp`'s copy of Playwright from the npx cache. If it says it
cannot find one, run `npx -y @playwright/mcp@latest --version` once and try again.

## Prove it

`prove-parallel.py` spawns real MCP servers over stdio, points each at a local page that
counts `requestAnimationFrame` frames, and prints one line per server.

```
python -I parallel-browsers/prove-parallel.py shared 3
python -I parallel-browsers/prove-parallel.py isolated 3
```

- **Control (`shared`).** All servers share one `--user-data-dir`. It should reproduce the
  old failure: at least one server prints `LAUNCH FAILED` with the "already in use" error.
  Mine: 3 launched at once, 1 failed with that exact message.
- **The fix (`isolated`).** A pass is `ok=N` out of N, every server `OK`, each with a frame
  count and `visibilityState` of `visible`. Mine: 6 servers at once, 6 of 6 launched, each
  counted roughly 50 to 66 frames in 1 second. The frame count is there because a hidden
  or starved tab would count near zero.
- If `pw-storage-state.json` does not exist yet, the isolated run says so and goes without
  `--storage-state`, so you can run the proof before step 5.
- No Edge? Set `PW_BROWSER=chromium` first.

Trust the green only after the shared run has shown you the red.

## The mindset

A shared resource every worker needs is a hidden lock. Here it was one browser profile.
Give each worker its own copy. Seed each copy with only what it needs: a handful of
logins, not everything the browser ever saw. Then prove it with a control that reproduces
the old failure before you trust the new green.

The seed matters. My saved profile held 1,659 cookies on 368 sites, almost all ad
trackers and not one real login. The allowlist sweep kept 25, and the storage-state file
went from 525 KB to 6.8 KB. Opening a new browser context went from about 175 ms median
to about 129 ms (an empty file is about 110 ms).

## Notes

- Storage state carries cookies only. A site that keeps its login in localStorage needs a
  fresh login each session.
- Isolated tabs keep nothing after they close. Log in through `playwright-profile`, then
  run `refresh-logins.mjs`, and every new tab has it.
- Isolation removes the browser lock, not CPU contention. Timing-sensitive checks (frame
  rates, animation gates) still need a quiet CPU, so do not run six of them at once and
  expect clean numbers.
- Close the `playwright-profile` browser before running `refresh-logins.mjs`: the profile
  is locked while it is open. The script copies the cookie database to
  `C:\Users\<you>\.claude\pw-profile-cookie-backups\` before it launches anything.
- Everything is derived from your home folder (`C:\Users\<you>`), so the scripts need no
  edits except the allowlist. I run this on Windows with Edge. To use Chrome, change
  `msedge` to `chrome` in the setup commands and in the `channel:` line of
  `refresh-logins.mjs`.
- Never commit `pw-storage-state.json`. It is your logins. The `.gitignore` here blocks it.
- Running Claude in a browser with a debug port instead? See
  [`../claude-in-edge/README.md`](../claude-in-edge/README.md).

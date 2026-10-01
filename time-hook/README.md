# Time hook: stamp the real date and time on every prompt

Claude Code has no live clock. Left alone it guesses the date, and the guess is
often months stale. This tiny hook fixes that: it runs a one-line Python script
before every message you send and prepends the real local time, read fresh from
your computer's clock, so Claude always knows what day it is.

## What is in here

| File | What it is |
|---|---|
| `now-local.py` | Prints the current local date and time from the OS clock. No network, no hardcoded time zone, DST handled automatically. |

## Setup (once)

1. **Copy the script** somewhere stable, e.g. `C:\Users\<you>\.claude\now-local.py`.
2. **Wire it into the UserPromptSubmit hook** in `C:\Users\<you>\.claude\settings.json`.
   Add (or merge into) a `hooks` block like this. Use forward slashes in the path,
   and point it at wherever you saved the script:

   ```json
   {
     "hooks": {
       "UserPromptSubmit": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "python \"C:/Users/<you>/.claude/now-local.py\" 2>/dev/null",
               "shell": "bash"
             }
           ]
         }
       ]
     }
   }
   ```

3. **Restart Claude Code** (or start a new session). Send any message and you should
   see a line like:

   > Right now it is Wednesday, July 15, 2026 at 2:00 PM Central Daylight Time.

## The full chain

The snippet above runs only the clock. The version Chris actually runs prints the
clock, then her standing rules, then pipes all of it through a size guard
(`hook_budget.py`) so nothing gets silently cut. There is also a PreCompact hook
for handoffs. The complete, copy-pasteable settings.json block for all of it is in
[`../hooks/README.md`](../hooks/README.md). Start there if you want the whole setup.

## Notes

- Needs Python on PATH. Test it standalone first: `python now-local.py`.
- The same UserPromptSubmit hook is a handy place to inject anything you want in front
  of every prompt (a standing-rules file, a project reminder). Just add another command
  after the time one, e.g. `cat "C:/path/to/your-rules.txt"`.
- On Mac or Linux the script is identical; only the path in the hook changes.

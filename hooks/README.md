# Hooks: the full chain, as it runs for Chris

Claude Code can run a command at certain moments and put its output in front of
Claude. Chris uses two of those moments:

- **UserPromptSubmit**: runs every time you send a message. Whatever it prints is
  injected into Claude's context along with your message.
- **PreCompact**: runs right before Claude Code compacts a long conversation. It
  tells Claude how to write the summary so nothing important is lost.

## What is in here

| File | What it is |
|---|---|
| `hook_budget.py` | A size guard. Reads the whole payload on stdin, trims it if it is over the cap, prints the result. Never trims the rules. |
| `compact-handoff.txt` | The instruction Claude receives before compaction: fill in a handoff form, then keep working. |

Related files in other folders:

| File | What it is |
|---|---|
| `../time-hook/now-local.py` | Prints the real local date and time. |
| `../claude-rules/hard-rules.template.txt` | A fill-in standing-rules file. Chris's own rules, with the story behind each, are in `../claude-rules/RULES.md`. |

## The chain on every message

```
{ now-local.py ; blank line ; hard-rules.txt ; (memory router) ; } | hook_budget.py
```

1. **Time stamp.** `now-local.py` prints the date and time straight from your
   computer's clock, so Claude never guesses the date.
2. **Standing rules.** `hard-rules.txt` is printed as is. These are the rules that
   win when a rule and Claude's plan conflict.
3. **Memory router (coming later, not in this repo yet).** In Chris's setup a third
   script reads the message, works out which project notes are relevant, and prints
   them. It is not shipped here yet. The chain below works without it, and
   `hook_budget.py` is written to handle it when you add one (see "Adding a router").
4. **Budget guard.** Everything above is piped through `hook_budget.py`. If the
   payload is over the cap (9,000 bytes by default, set `HOOK_BUDGET_CAP` to change
   it), it shrinks the least important part first and never touches the rules. If
   the rules alone are over the cap, it prints a warning on the first line so the
   failure is loud instead of silent.

Why a guard at all: past a size limit, Claude Code spills the injected text to a
file and only a short preview of the START reaches Claude. The end is what dies,
and the rules sit near the front, but whatever you put after them dies silently.
The full story is at the bottom of `../claude-rules/RULES.md`.

## Install

1. Copy these files into your Claude folder (`~/.claude/`, which on Windows is
   `C:\Users\<you>\.claude\`):

   | From this repo | To |
   |---|---|
   | `time-hook/now-local.py` | `~/.claude/now-local.py` |
   | `claude-rules/hard-rules.template.txt` (edited) | `~/.claude/hard-rules.txt` |
   | `hooks/hook_budget.py` | `~/.claude/hook_budget.py` |
   | `hooks/compact-handoff.txt` | `~/.claude/compact-handoff.txt` |

2. Open `~/.claude/settings.json` and add this `hooks` block. If you already have a
   `hooks` section, merge the two events into it instead of replacing it.

   ```json
   {
     "hooks": {
       "UserPromptSubmit": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "{ python \"$HOME/.claude/now-local.py\" 2>/dev/null; echo \"\"; cat \"$HOME/.claude/hard-rules.txt\" 2>/dev/null || true; } | python \"$HOME/.claude/hook_budget.py\"",
               "shell": "bash"
             }
           ]
         }
       ],
       "PreCompact": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "cat \"$HOME/.claude/compact-handoff.txt\"",
               "shell": "bash",
               "statusMessage": "Writing handoff form before compacting..."
             }
           ]
         }
       ]
     }
   }
   ```

   Notes on the block:
   - `$HOME/.claude` is the same place as `~/.claude`. The tilde does not expand
     inside quotes, so the block uses `$HOME`.
   - `"shell": "bash"` runs the command in bash. On Windows that is Git Bash, which
     comes with Git for Windows.
   - Use `python3` instead of `python` if that is what your machine calls it.
   - `2>/dev/null` and `|| true` keep a missing file from breaking your message.
     A hook that errors should never cost you the turn.

3. **Restart Claude Code** (or open a new session).

## Check that it works

Run the exact message hook by hand in a bash shell:

```
{ python "$HOME/.claude/now-local.py"; echo ""; cat "$HOME/.claude/hard-rules.txt"; } | python "$HOME/.claude/hook_budget.py"
```

You should see the time line, then your rules. Then, in a Claude Code session, ask
"how many standing rules did you receive?" The answer should match the number in
your first rule.

Test the guard on its own with a small cap, to see the warning:

```
cat ~/.claude/hard-rules.txt | HOOK_BUDGET_CAP=100 python ~/.claude/hook_budget.py | head -3
```

The first line should say the payload is over the cap. Remove the variable and it
goes quiet.

To check the compaction hook, run `/compact` in a session. You should see the
status message, and the summary Claude writes should follow the eight-part form.

## Adding a router (or anything else) later

Anything you print between the rules and the pipe becomes part of the payload.
`hook_budget.py` recognizes two optional blocks and shrinks them when needed:

- A section that starts with a line beginning `=== ROUTED MEMORY` and ends with a
  line `=== END ROUTED MEMORY ===`, containing entries that each start with a line
  like `--- name : description ---`. Largest entries are cut first, each down to a
  one-line pointer.
- A block that starts with `=== CHATROOM` and runs to the next `=== ` line. It is
  dropped whole if routed memory was not enough.

Anything else you add is treated as protected, like the rules. Keep it small.

## What the compaction handoff does

`compact-handoff.txt` is printed before compaction, so Claude reads it while it is
writing the summary. It asks for eight sections: mission, done, in flight, next
steps, files touched, decisions and constraints, gotchas, open questions. It ends
by telling Claude to continue from NEXT STEPS without greeting or re-planning.
Edit the form to suit your work. The structure is what matters: a summary that
names exact file paths and the exact step in progress survives compaction far
better than a general recap.

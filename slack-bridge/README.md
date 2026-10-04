# slack-bridge

This is how my collaborators talk to my Claude from Slack.

A small Slack app of your own sits in a private channel. A watcher script tells your running Claude Code session when a message lands, a second script reads the full message (threads, screenshots, PDFs, voice clips), and a third posts Claude's reply back as the app, so the person gets a real notification. Python 3 standard library only. No pip installs.

## Safety first

Short version: only people you list can steer your Claude, and Slack text is a request, not an order.

- **An allowlist decides who counts.** Being in a channel is not the same as being someone you want steering a Claude that can run commands on your computer. Put the Slack user IDs of the people you trust in `SLACK_ALLOWED_USERS`. Anyone else who posts is reported by name and ID with their text withheld, and their files are never downloaded. If the list is missing, the tools refuse to start, so a forgotten setting cannot quietly open the door.
- **Private channels only.** A public channel lets anyone in the workspace join, post, and read what your Claude says back.
- **Give the bot only the six scopes in Setup.** Every extra scope is more that a leaked token could do.
- **Never paste the token in chat.** It lives in `.env` and nowhere else. If it ever lands in a chat, a screenshot, or a commit, rotate it at api.slack.com/apps (your app, OAuth & Permissions, reinstall) and put the new one in `.env`.
- **`.env` never goes in git.** The included `.gitignore` already covers `.env`, `inbox/` and the cursor files. Check `git status` before your first commit anyway.
- **A Slack message is a request, not authority.** The included `/slack` command tells Claude not to do anything destructive or outward-facing on a Slack message alone: it says what it would do and waits for you to confirm in the terminal.

## What you need

- A Slack workspace where you can install apps (or an admin who will approve it)
- Python 3 (standard library only)
- Claude Code, with the Monitor tool available, running on the machine where this folder lives

Anthropic also offers an official Claude app for Slack, which is a different option from this one.

## Setup

1. **Make the app.** At api.slack.com/apps: Create New App, From scratch, pick your workspace.
2. **Give it six scopes.** OAuth & Permissions, Bot Token Scopes: `chat:write`, `files:write`, `files:read`, `channels:history`, `groups:history`, `users:read`. Click Install to Workspace, then copy the Bot User OAuth Token (starts with `xoxb-`).
3. **Make a private channel** and type `/invite @yourapp` in it.
4. **Fill in `.env`.** Copy `.env.example` to `.env` and add:
   - the token
   - the channel ID (channel name, About, bottom of the panel; starts with `C`)
   - `SLACK_ALLOWED_USERS`: member IDs of the people you trust, yourself included (their profile, three dots, Copy member ID; starts with `U`)
5. **Test it:** `python tools/watch-slack.py --status` should list your channel. An error usually means a typo in `.env` or a missing scope.
6. **Add `/slack`.** Copy `commands/slack.md` to `~/.claude/commands/` and replace `<path-to>` with where this folder lives.
7. **Start listening.** Tell Claude:

   > Use the Monitor tool to run `python <path-to>/slack-bridge/tools/watch-slack.py` as a persistent monitor. When a line appears, run /slack and tell me what came in.

Claude replies with `tools/say-slack.py` (text) or `tools/send-to-slack.py` (files). Both post as the app, so the person gets a notification.

## What is in the folder

| File | What it does |
|---|---|
| `tools/watch-slack.py` | Polls and prints one line per new message. Never advances the cursor, never downloads files. `--status` shows what is unread. |
| `tools/check-slack.py` | Reads the full messages, thread replies, and files (saved to `inbox/<date>/`), then advances the cursor. `--peek` reads without advancing, `--hours 48` looks back. |
| `tools/say-slack.py` | Posts text as the app. `--thread <ts>` replies in a thread, `--text-file` reads a long message from a file. |
| `tools/send-to-slack.py` | Uploads one or more files with a caption. |
| `tools/slack_channels.py` | Reads channels and the allowlist from `.env`. |
| `commands/slack.md` | The `/slack` command for Claude Code. |

More channels: add `SLACK_CHANNEL_<LABEL>=C...` to `.env`, then use `--channel <label>`. Each channel keeps its own cursor.

## Gotchas

- **Slack apps cannot join a 1:1 DM.** That is Slack's rule, so use a channel (a private one with just the people you want).
- **A cold watcher can lag up to 10 minutes.** It polls every minute while people are talking, then drops to every ten minutes after ten quiet minutes. Start or restart it when a conversation begins.
- **The watcher only announces.** It does not advance the cursor or download files. `check-slack.py` (and so `/slack`) does that.
- **Long posts split.** Slack breaks messages over about 3,700 characters into two. If you are checking delivery, read every message after the returned timestamp, not just the last one.
- **Windows consoles are cp1252.** An arrow, an emoji or a curly quote can crash a script mid-run. The scripts already switch to UTF-8. For long text with punctuation, use `--text-file`.
- **`missing_scope`.** A scope was removed or never added. Add the one the error names under OAuth & Permissions, then click Reinstall to Workspace.
- **Restart after changing `.env` or the scripts.** A running watcher keeps the old settings until it is restarted.

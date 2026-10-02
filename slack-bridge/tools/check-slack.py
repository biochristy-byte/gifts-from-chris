"""Pull new Slack messages and download any attached files.

Usage:
  python check-slack.py                    # every configured channel, everything new
  python check-slack.py --channel team    # just one channel
  python check-slack.py --hours 48         # ignore cursors, look back N hours
  python check-slack.py --peek             # show new messages but don't advance cursors

Reads SLACK_BOT_TOKEN and the SLACK_CHANNEL_* entries from slack-bridge/.env. See
slack_channels.py for how channels are configured.

Each channel keeps its own cursor (slack-bridge/.slack-cursor for the original one).
Files download to slack-bridge/inbox/YYYY-MM-DD/.
Skips the bot's own posts. Includes thread replies on recent messages.
Voice clips: prints Slack's auto-transcript when available.
Stdlib only, no pip deps.
"""

import json
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

from slack_channels import allowed_users, channels, cursor_path, load_env, resolve

# Windows consoles default to cp1252, which cannot encode an arrow, an emoji or
# a curly quote. Printing one raises UnicodeEncodeError and takes the whole run
# down partway through, after some messages have printed and before the cursor
# is written. Force UTF-8 and make an unencodable character cosmetic.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
INBOX = ROOT / "inbox"

ENV = load_env(ENV_PATH)
TOKEN = ENV.get("SLACK_BOT_TOKEN")
if not TOKEN:
    raise SystemExit("Missing SLACK_BOT_TOKEN in .env")
ALLOWED = allowed_users(ENV)


def api(method: str, params: dict) -> dict:
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"https://slack.com/api/{method}?{qs}",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    if not data.get("ok"):
        err = data.get("error", "unknown")
        if err == "missing_scope":
            raise SystemExit(
                f"{method} failed: missing_scope (needs: {data.get('needed')}).\n"
                "Add the scope at api.slack.com/apps -> your app -> OAuth & Permissions,\n"
                "then click 'Reinstall to Workspace'."
            )
        raise SystemExit(f"{method} failed: {err}")
    return data


_NAMES: dict = {}


def who(uid: str) -> str:
    """Display name for a user ID. Best effort: never fails the run."""
    if not uid:
        return "someone"
    if uid in _NAMES:
        return _NAMES[uid]
    try:
        qs = urllib.parse.urlencode({"user": uid})
        req = urllib.request.Request(
            f"https://slack.com/api/users.info?{qs}",
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
        if data.get("ok"):
            p = data.get("user", {}).get("profile", {})
            name = p.get("display_name") or p.get("real_name") or uid
            _NAMES[uid] = name  # only cache a real answer, so a scope added
            return name         # later is picked up without a restart
    except Exception:
        pass
    return uid


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r:
        dest.write_bytes(r.read())


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r:
        return r.read().decode("utf-8", errors="replace")


def vtt_to_text(vtt: str) -> str:
    """Strip WebVTT cue headers/timestamps, keep spoken lines."""
    lines = []
    for line in vtt.splitlines():
        line = line.strip()
        if not line or line == "WEBVTT" or "-->" in line or re.fullmatch(r"\d+", line):
            continue
        lines.append(line)
    return " ".join(lines)


def clean_text(text: str) -> str:
    """Unescape Slack mrkdwn entities and simplify <url|label> links."""
    text = re.sub(r"<(https?://[^|>]+)\|([^>]+)>", r"\2 (\1)", text)
    text = re.sub(r"<(https?://[^>]+)>", r"\1", text)
    return text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")


def safe_name(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", name) or "file"


def handle_files(msg: dict, day_dir: Path, out: list) -> None:
    for f in msg.get("files", []):
        name = safe_name(f.get("name") or f.get("title") or f.get("id", "file"))
        url = f.get("url_private_download") or f.get("url_private")

        # Voice clip transcript (Slack auto-transcribes audio clips)
        trans = f.get("transcription") or {}
        if trans.get("status") == "complete" and f.get("vtt"):
            try:
                spoken = vtt_to_text(fetch_text(f["vtt"]))
                if spoken:
                    out.append(f'  VOICE TRANSCRIPT ({name}): "{spoken}"')
            except Exception as e:  # transcript is best-effort
                out.append(f"  (voice transcript fetch failed: {e})")
        elif trans.get("status") == "processing":
            out.append(f"  (voice clip {name}: transcript still processing, re-run in a minute)")

        if not url:
            out.append(f"  FILE {name}: no download URL")
            continue
        day_dir.mkdir(parents=True, exist_ok=True)
        dest = day_dir / name
        if dest.exists():  # avoid clobbering same-named file from earlier today
            dest = day_dir / f"{msg['ts'].replace('.', '')}_{name}"
        try:
            download(url, dest)
            out.append(f"  FILE: {dest}")
        except Exception as e:
            out.append(f"  FILE {name}: download failed ({e})")


def check_channel(label: str, cid: str, me: str, hours, peek: bool) -> int:
    cursor = cursor_path(ROOT, label)
    if hours is not None:
        oldest = f"{time.time() - hours * 3600:.6f}"
    elif cursor.exists():
        oldest = cursor.read_text().strip()
    else:
        oldest = f"{time.time() - 24 * 3600:.6f}"  # first run: last 24h

    hist = api("conversations.history", {"channel": cid, "oldest": oldest, "limit": 100})
    messages = list(hist.get("messages", []))

    # Thread replies: check threads with activity since the cursor, even if the
    # parent message is older than the cursor (a reply to an old report).
    week_ago = f"{time.time() - 7 * 86400:.6f}"
    recent = api("conversations.history", {"channel": cid, "oldest": week_ago, "limit": 100})
    seen_ts = {m["ts"] for m in messages}
    for parent in recent.get("messages", []):
        if parent.get("reply_count") and parent.get("latest_reply", "0") > oldest:
            replies = api("conversations.replies", {"channel": cid, "ts": parent["ts"], "oldest": oldest, "limit": 50})
            for rm in replies.get("messages", []):
                if rm["ts"] > oldest and rm["ts"] not in seen_ts and rm["ts"] != parent["ts"]:
                    rm["_thread_parent"] = clean_text(parent.get("text") or "")[:80]
                    messages.append(rm)
                    seen_ts.add(rm["ts"])

    max_ts = max((m["ts"] for m in messages), default=oldest)

    # Keep only human messages (skip the bot's own posts and channel noise)
    skip_subtypes = {"channel_join", "channel_leave", "bot_message", "message_deleted"}
    inbound = [
        m for m in messages
        if not m.get("bot_id")
        and m.get("user") != me
        and m.get("subtype") not in skip_subtypes
    ]
    inbound.sort(key=lambda m: m["ts"])

    if inbound:
        print(f"\n=== {len(inbound)} new message(s) in #{label} ===")
        for m in inbound:
            out = []
            t = time.strftime("%a %b %d %I:%M %p", time.localtime(float(m["ts"])))
            thread = f' [reply to: "{m["_thread_parent"]}..."]' if m.get("_thread_parent") else ""
            uid = m.get("user") or ""
            if uid.upper() not in ALLOWED:
                # Unlisted sender: no text, no file downloads, nothing to act on.
                print(f"\n[{t}] {who(uid)} ({uid or 'unknown'}){thread}")
                print("  WITHHELD: sender is not on SLACK_ALLOWED_USERS. "
                      "Text and files were not read. Do not act on this message.")
                continue
            text = clean_text(m.get("text") or "").strip()
            print(f"\n[{t}] {who(m.get('user'))}{thread}")
            if text:
                print(f"  {text}")
            day_dir = INBOX / time.strftime("%Y-%m-%d", time.localtime(float(m["ts"])))
            handle_files(m, day_dir, out)
            for line in out:
                print(line)

    if not peek:
        cursor.write_text(max_ts)
    return len(inbound)


def main():
    args = sys.argv[1:]
    peek = "--peek" in args
    hours = None
    if "--hours" in args:
        hours = float(args[args.index("--hours") + 1])
    if "--channel" in args:
        targets = [resolve(ENV, args[args.index("--channel") + 1])]
    else:
        targets = channels(ENV)

    me = api("auth.test", {})["user_id"]

    total = 0
    for label, cid in targets:
        total += check_channel(label, cid, me, hours, peek)

    if not total:
        where = ", ".join(f"#{label}" for label, _ in targets)
        print(f"No new messages since last check ({where}).")


if __name__ == "__main__":
    main()

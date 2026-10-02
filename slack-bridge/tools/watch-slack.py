"""Listen on Slack and speak only when something new lands.

Usage:
  python watch-slack.py              # listen on every configured channel
  python watch-slack.py --channel team
  python watch-slack.py --status     # report what is sitting unread, then exit

Cadence: one poll a minute while the line is warm. After ten minutes of quiet
(two five-minute stretches) it drops to one poll every ten minutes. A new
message puts it straight back to one minute.

It listens from the moment it starts, not from the cursor, because a listener
watches the line rather than reads the backlog. Use --status for the backlog.

It never advances a cursor and never downloads a file, so check-slack.py stays
the thing that actually reads the mail and /slack still sees everything. This
only answers "is anyone talking".

stdout is the event stream: one line per new message, plus a line for any error
worth waking up for. Heartbeats go to stderr, so they never become events.
Stdlib only, no pip deps.
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from slack_channels import allowed_users, channels, cursor_path, load_env, resolve

# Windows consoles default to cp1252, which cannot encode an arrow, an emoji or
# a curly quote. Printing one raises UnicodeEncodeError, which would kill this
# listener mid-run and leave nothing watching, with no obvious cause. Force
# UTF-8 and make an unencodable character cosmetic instead of fatal.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
ENV = load_env(ROOT / ".env")
TOKEN = ENV.get("SLACK_BOT_TOKEN")
if not TOKEN:
    raise SystemExit("Missing SLACK_BOT_TOKEN in .env")
ALLOWED = allowed_users(ENV)

WARM = 60           # poll every minute while someone is talking
COLD = 600          # ...and every ten minutes once the line goes cold
GO_COLD_AFTER = 600  # ten minutes of quiet: two five-minute stretches
REALERT_AFTER = 900  # do not repeat the same error more than once every 15 min

SKIP = {"channel_join", "channel_leave", "bot_message", "message_deleted"}


def say(line: str) -> None:
    """An event. Every one of these becomes a notification, so earn it."""
    print(line, flush=True)


def beat(line: str) -> None:
    """A heartbeat. Goes to the log, never becomes a notification."""
    print(line, file=sys.stderr, flush=True)


def api(method: str, params: dict) -> dict:
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"https://slack.com/api/{method}?{qs}",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


_NAMES: dict = {}


def who(uid: str) -> str:
    """Display name for a user ID. Best effort: never kills the listener.

    Only a real answer gets cached. Caching the fallback would mean that if the
    users:read scope is added while this is running, every name stays a raw ID
    forever and the fix looks like it did not work.
    """
    if not uid:
        return "someone"
    if uid in _NAMES:
        return _NAMES[uid]
    try:
        data = api("users.info", {"user": uid})
        if data.get("ok"):
            p = data.get("user", {}).get("profile", {})
            name = p.get("display_name") or p.get("real_name") or uid
            _NAMES[uid] = name
            return name
    except Exception:
        pass
    return uid


def humans(messages: list, me: str) -> list:
    return [
        m for m in messages
        if not m.get("bot_id")
        and m.get("user") != me
        and m.get("subtype") not in SKIP
    ]


def describe(label: str, m: dict) -> str:
    t = time.strftime("%I:%M %p", time.localtime(float(m["ts"])))
    uid = m.get("user") or ""
    if uid.upper() not in ALLOWED:
        # Never pass an unlisted sender's words into the session.
        return (f"[{t}] #{label} WITHHELD: message from {who(uid)} ({uid or 'unknown'}), "
                f"who is not on SLACK_ALLOWED_USERS. Not read, not acted on.")
    text = " ".join((m.get("text") or "").split())[:220] or "(no text)"
    files = m.get("files") or []
    tail = f"  [+{len(files)} file(s)]" if files else ""
    return f"[{t}] #{label} {who(m.get('user'))}: {text}{tail}"


def status(targets: list, me: str) -> None:
    for label, cid in targets:
        cur = cursor_path(ROOT, label)
        oldest = cur.read_text().strip() if cur.exists() else "0"
        try:
            data = api("conversations.history", {"channel": cid, "oldest": oldest, "limit": 200})
        except Exception as e:
            print(f"#{label}: could not reach Slack ({e})")
            continue
        if not data.get("ok"):
            print(f"#{label}: Slack said {data.get('error')}")
            continue
        waiting = humans(data.get("messages", []), me)
        if cur.exists():
            when = time.strftime("%m/%d %I:%M %p", time.localtime(float(oldest)))
            days = (time.time() - float(oldest)) / 86400
            mark = f"cursor at {when}, {days:.1f} days back"
        else:
            mark = "no cursor yet"
        print(f"#{label}: {len(waiting)} unread human message(s), {mark}")
        for m in sorted(waiting, key=lambda m: m["ts"])[-5:]:
            print("   " + describe(label, m))


def listen(targets: list, me: str) -> None:
    seen = {label: f"{time.time():.6f}" for label, _ in targets}
    alerted: dict = {}
    quiet_since = time.time()

    where = ", ".join(f"#{label}" for label, _ in targets)
    say(f"Listening on {where}. Every {WARM}s while warm, "
        f"every {COLD // 60} min after {GO_COLD_AFTER // 60} min of quiet.")

    while True:
        heard = False
        for label, cid in targets:
            try:
                data = api("conversations.history",
                           {"channel": cid, "oldest": seen[label], "limit": 50})
                problem = None if data.get("ok") else (
                    f"Slack said {data.get('error')}"
                    + (f" (needs {data.get('needed')})" if data.get("needed") else "")
                )
            except Exception as e:
                data, problem = {}, f"call failed ({e})"

            if problem:
                # Never go silent on a failure, but never spam the same one either.
                last = alerted.get(label)
                if not last or last[0] != problem or time.time() - last[1] > REALERT_AFTER:
                    say(f"ALERT #{label}: {problem}")
                    alerted[label] = (problem, time.time())
                continue
            alerted.pop(label, None)

            messages = data.get("messages", [])
            if messages:
                seen[label] = max(m["ts"] for m in messages)
            for m in sorted(humans(messages, me), key=lambda m: m["ts"]):
                heard = True
                say(describe(label, m))

        now = time.time()
        if heard:
            quiet_since = now
        gap = COLD if now - quiet_since >= GO_COLD_AFTER else WARM
        beat(f"{time.strftime('%H:%M:%S')} quiet {int(now - quiet_since)}s, "
             f"next poll in {gap}s")
        time.sleep(gap)


def main():
    args = sys.argv[1:]
    if "--channel" in args:
        targets = [resolve(ENV, args[args.index("--channel") + 1])]
    else:
        targets = channels(ENV)

    me = api("auth.test", {})["user_id"]

    if "--status" in args:
        status(targets, me)
    else:
        listen(targets, me)


if __name__ == "__main__":
    main()

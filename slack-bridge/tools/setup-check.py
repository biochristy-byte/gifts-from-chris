"""Check your Slack Bridge setup, one README step at a time.

Usage:
  python setup-check.py

Read only. It never posts, never downloads a file and never moves a cursor, so
it is safe to run as often as you like. Every problem names the README Setup
step that fixes it. Fix the first one and run it again: later problems often
clear up on their own.

Exit code 0 when everything needed works (notes allowed), 1 otherwise.
Stdlib only, no pip deps.
"""

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from slack_channels import ALLOW_KEY, PREFIX, load_env

# Same reason as the other tools: a cp1252 console must not crash on a name
# with an emoji in it.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
COMMAND = Path.home() / ".claude" / "commands" / "slack.md"

# The six scopes in slack-app-manifest.yml. Keep the two lists in step.
NEEDED = ["chat:write", "files:write", "files:read",
          "channels:history", "groups:history", "users:read"]

# The sample values in .env.example. Still seeing one means step 4 is unfinished.
SAMPLES = {"xoxb-your-token", "C0123456789", "U0123456789", "U0987654321"}

CHANNEL_ID = re.compile(r"^[CG][A-Z0-9]{6,}$")
USER_ID = re.compile(r"^[UW][A-Z0-9]{6,}$")

FAILS = []
NOTES = []


def ok(msg: str) -> None:
    print(f"  OK    {msg}")


def note(msg: str) -> None:
    NOTES.append(msg)
    print(f"  NOTE  {msg}")


def fail(msg: str, fix: str) -> None:
    FAILS.append(msg)
    print(f"  FIX   {msg}")
    print(f"        {fix}")


def api(token: str, method: str, params: dict):
    """One read-only Web API call. Returns (json, the token's scopes or None)."""
    req = urllib.request.Request(
        f"https://slack.com/api/{method}?{urllib.parse.urlencode(params)}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read()), r.headers.get("x-oauth-scopes")


def check_env():
    print("Your .env")
    path = ROOT / ".env"
    if not path.exists():
        fail(f"No .env in {ROOT}.",
             "Step 4: copy .env.example to .env (same folder) and fill it in.")
        return None
    ok(f"Found {path}")
    return load_env(path)


def check_token(env: dict):
    """Returns (token, the app's own user ID, scopes header) or None."""
    print("\nThe bot token (steps 1 and 2)")
    token = env.get("SLACK_BOT_TOKEN", "")
    if not token or token in SAMPLES:
        fail("SLACK_BOT_TOKEN is empty or still the sample.",
             "Step 2: in your app, OAuth & Permissions, copy the Bot User OAuth "
             "Token into .env.")
        return None
    if token.startswith("xoxp-"):
        fail("That is a user token (xoxp-), which posts as you and never pings anyone.",
             "Step 2: use the Bot User OAuth Token instead. It starts with xoxb-.")
        return None
    if not token.startswith("xoxb-"):
        fail("SLACK_BOT_TOKEN does not start with xoxb-.",
             "Step 2: copy the Bot User OAuth Token again, the whole thing.")
        return None
    try:
        data, scopes = api(token, "auth.test", {})
    except (urllib.error.URLError, OSError) as e:
        fail(f"Could not reach slack.com ({e}).",
             "Check your internet connection, then run this again.")
        return None
    if not data.get("ok"):
        fail(f"Slack rejected the token ({data.get('error')}).",
             "Step 2: copy the Bot User OAuth Token again. Reinstalling the app "
             "or rotating the token makes the old one stop working.")
        return None
    ok(f"Token works: the app is @{data.get('user')} in {data.get('team')}.")
    return token, data.get("user_id"), scopes


def check_scopes(scopes) -> None:
    print("\nScopes (step 1)")
    if scopes is None:
        note("Slack did not list the token's scopes. The channel and people "
             "checks below still test the ones that can be tested safely.")
        return
    granted = {s.strip() for s in scopes.split(",") if s.strip()}
    missing = [s for s in NEEDED if s not in granted]
    if missing:
        fail(f"Missing: {', '.join(missing)}.",
             "Step 1: add them under OAuth & Permissions, Bot Token Scopes, then "
             "click Reinstall to Workspace. Or recreate the app from "
             "slack-app-manifest.yml.")
    else:
        ok(f"All six are there: {', '.join(NEEDED)}.")
    extra = sorted(granted - set(NEEDED))
    if extra:
        shown = ", ".join(extra[:8]) + (", ..." if len(extra) > 8 else "")
        note(f"{len(extra)} more scope(s) than the tools need ({shown}). They "
             "still work, but every extra scope is more that a leaked token could do.")


def check_channels(env: dict, token: str) -> None:
    print("\nChannels (steps 3 and 4)")
    configured = [(("main" if k == PREFIX + "ID" else k[len(PREFIX):].lower()), v)
                  for k, v in sorted(env.items()) if k.startswith(PREFIX) and v]
    if not configured:
        fail("No channel in .env.",
             "Step 4: add SLACK_CHANNEL_ID=C... (click the channel name, About, "
             "bottom of the panel).")
        return
    for label, cid in configured:
        where = f"#{label} ({cid})"
        if cid in SAMPLES:
            fail(f"{where} is still the sample ID.",
                 "Step 4: put your own channel's ID in .env.")
            continue
        if cid.startswith("D"):
            fail(f"{where} is a direct message. Slack apps cannot join a 1:1 DM.",
                 "Step 3: make a private channel instead and use its ID.")
            continue
        if not CHANNEL_ID.match(cid):
            fail(f"{where} does not look like a channel ID.",
                 "Step 4: use the ID, not the name. It starts with C (click the "
                 "channel name, About, bottom of the panel).")
            continue
        try:
            data, _ = api(token, "conversations.history", {"channel": cid, "limit": 1})
        except (urllib.error.URLError, OSError) as e:
            fail(f"{where}: could not reach Slack ({e}).", "Run this again.")
            continue
        err = data.get("error")
        if data.get("ok"):
            ok(f"{where}: the app is in it and can read it.")
        elif err == "not_in_channel":
            fail(f"{where}: the app is not in this channel.",
                 "Step 3: type /invite @ in the channel and pick your app.")
        elif err == "channel_not_found":
            fail(f"{where}: Slack cannot see this channel.",
                 "Either the ID has a typo (step 4), or it is a private channel "
                 "the app was never invited to (step 3: /invite @ and pick your app).")
        elif err == "missing_scope":
            fail(f"{where}: the token is missing {data.get('needed')}.",
                 "Step 1: add it under Bot Token Scopes, then Reinstall to Workspace.")
        else:
            fail(f"{where}: Slack said {err}.",
                 "Check the ID in .env (step 4) and that the app is invited (step 3).")


def check_people(env: dict, token: str, me: str) -> None:
    print(f"\nPeople allowed to talk to Claude (step 4, {ALLOW_KEY})")
    raw = env.get(ALLOW_KEY, "")
    ids = [u.strip().upper() for u in raw.split(",") if u.strip()]
    if not ids:
        fail(f"{ALLOW_KEY} is missing or empty. The tools refuse to start without it.",
             "Step 4: list member IDs, comma-separated, yourself included (profile, "
             "three dots, Copy member ID).")
        return
    for uid in ids:
        if uid in SAMPLES:
            fail(f"{uid} is a sample ID from .env.example.",
                 "Step 4: replace it with a real member ID.")
            continue
        if not USER_ID.match(uid):
            fail(f"{uid} does not look like a member ID.",
                 "Step 4: use Copy member ID on their profile. It starts with U, "
                 "not @ and not an email.")
            continue
        try:
            data, _ = api(token, "users.info", {"user": uid})
        except (urllib.error.URLError, OSError) as e:
            fail(f"{uid}: could not reach Slack ({e}).", "Run this again.")
            continue
        if not data.get("ok"):
            err = data.get("error")
            if err == "user_not_found":
                fail(f"{uid}: no such person in this workspace.",
                     "Step 4: check for a typo, or an ID copied from another workspace.")
            elif err == "missing_scope":
                fail(f"{uid}: the token cannot look people up (needs users:read).",
                     "Step 1: add users:read, then Reinstall to Workspace.")
            else:
                fail(f"{uid}: Slack said {err}.", "Step 4: check the ID.")
            continue
        user = data.get("user", {})
        p = user.get("profile", {})
        name = p.get("display_name") or p.get("real_name") or uid
        if uid == me:
            note(f"{uid} is the app itself. Its own posts are always skipped, "
                 "so this entry does nothing.")
        elif user.get("deleted"):
            note(f"{uid} ({name}) is deactivated in Slack.")
        elif user.get("is_bot"):
            note(f"{uid} ({name}) is a bot. Bot posts are always skipped.")
        else:
            ok(f"{uid}: {name}")


def check_command() -> None:
    print("\nThe /slack command (step 5)")
    if not COMMAND.exists():
        fail(f"No {COMMAND}.",
             "Step 5: copy commands/slack.md there and replace <path-to>.")
        return
    text = COMMAND.read_text(encoding="utf-8", errors="replace")
    if "<path-to>" in text:
        fail(f"{COMMAND} still says <path-to>.",
             f"Step 5: replace every <path-to> with {ROOT.parent.as_posix()}")
        return
    if ROOT.as_posix().lower() not in text.replace("\\", "/").lower():
        note(f"{COMMAND} does not mention {ROOT.as_posix()}. Fine if you moved "
             "this folder on purpose; otherwise /slack is reading a different copy.")
        return
    ok(f"{COMMAND} points at this folder.")


def main() -> int:
    env = check_env()
    if env is not None:
        got = check_token(env)
        if got:
            token, me, scopes = got
            check_scopes(scopes)
            check_channels(env, token)
            check_people(env, token, me)
        else:
            print("\n  (Skipped the scope, channel and people checks: they need a working token.)")
    check_command()

    print()
    if FAILS:
        print(f"{len(FAILS)} thing(s) to fix. Start with the first one, then run this again.")
        return 1
    extra = f", with {len(NOTES)} note(s) above" if NOTES else ""
    print(f"All set{extra}. Next, step 7: start listening.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

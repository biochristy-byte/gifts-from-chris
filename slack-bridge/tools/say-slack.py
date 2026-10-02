"""Post a text message to Slack as your Slack app bot.

Usage:
  python say-slack.py --channel team "some text"
  python say-slack.py --channel team --text-file msg.txt
  python say-slack.py --channel team --thread 1756... "a threaded reply"

send-to-slack.py uploads files. This one just talks.

It posts with the BOT token, so the message lands as your app, not as you, and
actually notifies people. Do not use a Slack MCP connector for this: it
authenticates as you, so the message posts under your name and Slack does not
notify a person about their own message.

For anything long or with punctuation the Windows console mangles, write the
message to a UTF-8 .txt and use --text-file.

Stdlib only, no pip deps.
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from slack_channels import channels, load_env, resolve

ROOT = Path(__file__).resolve().parent.parent
ENV = load_env(ROOT / ".env")
TOKEN = ENV.get("SLACK_BOT_TOKEN")
if not TOKEN:
    raise SystemExit("Missing SLACK_BOT_TOKEN in .env")


def post(payload: dict) -> dict:
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    args = sys.argv[1:]

    channel_arg = None
    if "--channel" in args:
        i = args.index("--channel")
        if i + 1 >= len(args):
            raise SystemExit("--channel needs a channel label")
        channel_arg = args[i + 1]
        del args[i:i + 2]

    thread = None
    if "--thread" in args:
        i = args.index("--thread")
        if i + 1 >= len(args):
            raise SystemExit("--thread needs a message timestamp")
        thread = args[i + 1]
        del args[i:i + 2]

    if "--text-file" in args:
        i = args.index("--text-file")
        if i + 1 >= len(args):
            raise SystemExit("--text-file needs a path")
        text = Path(args[i + 1]).read_text(encoding="utf-8")
        del args[i:i + 2]
    elif args:
        text = args[0]
    else:
        print('Usage: python say-slack.py --channel <label> "<text>"')
        print("   or: python say-slack.py --channel <label> --text-file <msg.txt>")
        raise SystemExit(2)

    text = text.strip()
    if not text:
        raise SystemExit("Refusing to post an empty message.")

    label, cid = resolve(ENV, channel_arg) if channel_arg else channels(ENV)[0]

    payload = {"channel": cid, "text": text}
    if thread:
        payload["thread_ts"] = thread

    try:
        r = post(payload)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Slack HTTP {e.code}: {e.read().decode()}")

    if not r.get("ok"):
        raise SystemExit(f"chat.postMessage failed: {r.get('error')}")

    print(f"OK posted {len(text)} chars to #{label} ({cid}) as the bot, ts={r.get('ts')}")


if __name__ == "__main__":
    main()

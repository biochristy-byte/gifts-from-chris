"""Upload one or more files to a Slack channel via the Slack Web API.

Usage:
  python send-to-slack.py "<caption>" <path-to-file> [<path-to-file> ...]
  python send-to-slack.py --caption-file <caption.txt> <path-to-file> [...]
  python send-to-slack.py --channel team "<caption>" <path-to-file> [...]

The first arg is the caption (or --caption-file <path> to read a long caption
from a file). Remaining args are file paths. Multiple files bundle into a
single Slack message (used for carousels).

--channel picks where it lands. Without it, everything goes to the original
channel. See slack_channels.py for how channels are configured.

Reads SLACK_BOT_TOKEN and the SLACK_CHANNEL_* entries from slack-bridge/.env. Uses the
3-step external upload flow (getUploadURLExternal + direct upload +
completeUploadExternal). No external pip deps, stdlib only.
"""

import json
import mimetypes
import os
import sys
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

from slack_channels import channels, load_env, resolve


def slack_get(url: str, params: dict, token: str) -> dict:
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{url}?{qs}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def slack_post_json(url: str, data: dict, token: str) -> dict:
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def upload_bytes(presigned_url: str, content: bytes) -> None:
    req = urllib.request.Request(presigned_url, data=content, method="POST")
    with urllib.request.urlopen(req) as r:
        if r.status >= 300:
            raise RuntimeError(f"Upload failed: HTTP {r.status}")


def main():
    args = sys.argv[1:]

    channel_arg = None
    if "--channel" in args:
        i = args.index("--channel")
        if i + 1 >= len(args):
            raise SystemExit("--channel needs a channel label")
        channel_arg = args[i + 1]
        del args[i:i + 2]

    if len(args) < 2:
        print('Usage: python send-to-slack.py "<caption>" <file> [<file> ...]')
        print("   or: python send-to-slack.py --caption-file <caption.txt> <file> [<file> ...]")
        print("   add --channel <label> to send somewhere other than the original channel")
        raise SystemExit(2)

    if args[0] == "--caption-file":
        caption = Path(args[1]).read_text(encoding="utf-8")
        filepaths = [Path(p).resolve() for p in args[2:]]
    else:
        caption = args[0]
        filepaths = [Path(p).resolve() for p in args[1:]]

    if not filepaths:
        raise SystemExit("No files provided.")
    for fp in filepaths:
        if not fp.exists():
            raise SystemExit(f"File not found: {fp}")

    env_path = Path(__file__).resolve().parent.parent / ".env"
    env = load_env(env_path)
    token = env.get("SLACK_BOT_TOKEN")
    if not token:
        raise SystemExit("Missing SLACK_BOT_TOKEN in .env")
    label, channel = resolve(env, channel_arg) if channel_arg else channels(env)[0]

    uploaded = []  # [{id, title}]
    for fp in filepaths:
        size = fp.stat().st_size
        print(f"Uploading {fp.name} ({size:,} bytes)")
        try:
            r = slack_get(
                "https://slack.com/api/files.getUploadURLExternal",
                {"filename": fp.name, "length": size},
                token,
            )
        except urllib.error.HTTPError as e:
            raise SystemExit(f"Slack API HTTP error: {e.code} {e.read().decode()}")
        if not r.get("ok"):
            raise SystemExit(f"getUploadURLExternal failed for {fp.name}: {r}")
        upload_bytes(r["upload_url"], fp.read_bytes())
        uploaded.append({"id": r["file_id"], "title": fp.name})

    # Bundle all files into a single channel share with one caption.
    complete = slack_post_json(
        "https://slack.com/api/files.completeUploadExternal",
        {
            "files": uploaded,
            "channel_id": channel,
            "initial_comment": caption,
        },
        token,
    )
    if not complete.get("ok"):
        raise SystemExit(f"completeUploadExternal failed: {complete}")

    print(f"OK posted {len(uploaded)} file(s) to #{label} ({channel})")


if __name__ == "__main__":
    main()

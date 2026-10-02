"""Which Slack channels the tools talk to, and where each one keeps its cursor.

Channels are configured in slack-bridge/.env, one line each:

    SLACK_CHANNEL_ID=C...       your first channel, label "main"
    SLACK_CHANNEL_TEAM=C...     #team-claude, label "team"

To add a channel, add one more SLACK_CHANNEL_<LABEL> line. Nothing else changes.
check-slack.py reads every configured channel on a bare run, and both scripts
take --channel <label>.

Each channel gets its own cursor file, so reading one never marks another as
seen. The original channel keeps the original .slack-cursor, so adding a second
channel does not replay old messages.
"""

from pathlib import Path

PREFIX = "SLACK_CHANNEL_"
DEFAULT_LABEL = "main"
ALLOW_KEY = "SLACK_ALLOWED_USERS"


def allowed_users(env: dict) -> set:
    """Slack user IDs whose messages may reach Claude, from SLACK_ALLOWED_USERS.

    Comma-separated, e.g. SLACK_ALLOWED_USERS=U0123456789,U0987654321. Anyone else
    who posts in a watched channel is reported by ID with their text withheld,
    because a channel member is not the same thing as a person allowed to steer
    a Claude that can run commands on this machine. Fails closed: with no list,
    the tools refuse to start instead of listening to everybody.
    """
    ids = {u.strip().upper() for u in env.get(ALLOW_KEY, "").split(",") if u.strip()}
    if not ids:
        raise SystemExit(
            f"No {ALLOW_KEY} in .env. List the Slack user IDs allowed to talk to "
            "Claude, comma-separated. Refusing to listen to every channel member."
        )
    return ids


def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        raise SystemExit(f"Missing env file: {path}")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def channels(env: dict) -> list:
    """Every configured channel as (label, channel_id). The original comes first."""
    found = []
    main = env.get(PREFIX + "ID")
    if main:
        found.append((DEFAULT_LABEL, main))
    for key in sorted(env):
        if not key.startswith(PREFIX) or key == PREFIX + "ID":
            continue
        label = key[len(PREFIX):].lower()
        if label and env[key]:
            found.append((label, env[key]))
    if not found:
        raise SystemExit(f"No {PREFIX}* entry in .env")
    return found


def resolve(env: dict, name: str):
    """Turn a --channel value into (label, channel_id).

    Takes a label (team), a label with a hash (#team), or a raw channel ID.
    An ID that is not in .env is refused on purpose: a typo should not post to
    some other channel.
    """
    wanted = name.strip().lstrip("#").lower()
    configured = channels(env)
    for label, cid in configured:
        if wanted in (label, cid.lower()):
            return label, cid
    known = ", ".join(label for label, _ in configured)
    raise SystemExit(f"Unknown channel {name!r}. Configured: {known}")


def cursor_path(root: Path, label: str) -> Path:
    if label == DEFAULT_LABEL:
        return root / ".slack-cursor"
    return root / f".slack-cursor-{label}"

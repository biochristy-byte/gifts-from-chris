"""Print the current local time straight from this machine's OS clock.

No network, no hardcoded offset, no DST math: datetime.now().astimezone()
reads the OS clock and the OS-managed time zone, so the label flips between
Daylight/Standard Time on its own. Wire it into the UserPromptSubmit hook
(see README) and the current time is stamped at the top of every prompt, so
Claude never has to guess the date.
"""
from datetime import datetime


def main():
    local = datetime.now().astimezone()
    hour12 = local.hour % 12 or 12
    ampm = "AM" if local.hour < 12 else "PM"
    stamp = local.strftime("%A, %B %d, %Y at ") + f"{hour12}:{local.minute:02d} {ampm} " + local.strftime("%Z")
    print(f"Right now it is {stamp}. "
          f"This is read fresh from the computer clock each message; trust it over any earlier time guess.")


if __name__ == "__main__":
    main()

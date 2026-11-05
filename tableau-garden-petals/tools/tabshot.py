"""Screenshot the running Tableau Desktop window.

Read-only by design: it looks, it never clicks, types, saves or closes.

Two things this gets right that a naive grab does not:

  * It finds Tableau by PROCESS, not by window title. Matching "tableau" in a
    title also matches an editor or a browser tab that merely mentions Tableau,
    and you end up screenshotting the wrong application.
  * A screen grab only sees what is on top. If another window covers Tableau
    you capture that window instead, so Tableau is raised first.

The machine runs at 150% DPI (1707x1067 logical over 2560x1600 physical), so
the process declares per-monitor DPI awareness or every coordinate is wrong.

    python tools/tabshot.py [name]
"""
import ctypes
import sys
import time
from pathlib import Path

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

import psutil                        # noqa: E402
from PIL import ImageGrab            # noqa: E402
from pywinauto import Application     # noqa: E402

SHOTS = Path(__file__).resolve().parent.parent / "_shots"
SHOTS.mkdir(exist_ok=True)

user32 = ctypes.windll.user32


def tableau_pids():
    out = []
    for p in psutil.process_iter(["pid", "name"]):
        n = (p.info["name"] or "").lower()
        if n in ("tableau.exe", "tabpublic.exe"):
            out.append((p.info["pid"], n))
    return out


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else time.strftime("tab-%H%M%S")

    pids = tableau_pids()
    if not pids:
        print("No tableau.exe or tabpublic.exe process is running.")
        return 1
    print("Tableau processes:")
    for pid, n in pids:
        print(f"  pid {pid}  {n}")

    pid, pname = pids[0]
    app = Application(backend="uia").connect(process=pid, timeout=30)

    # Pick the largest top-level window belonging to that process.
    best, best_area = None, -1
    for w in app.windows():
        try:
            r = w.rectangle()
            area = r.width() * r.height()
            if area > best_area:
                best, best_area = w, area
        except Exception:
            pass
    if best is None:
        print("Connected to the process but found no window.")
        return 1

    title = best.window_text()
    r = best.rectangle()
    print(f"\nwindow: {title!r}  {r.width()}x{r.height()} at ({r.left},{r.top})")

    # Raise it, because a screen grab cannot see an occluded window.
    try:
        hwnd = best.handle
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, 9)      # SW_RESTORE
        best.set_focus()
    except Exception as e:
        print(f"  (could not raise the window: {e})")
    time.sleep(1.2)

    r = best.rectangle()
    img = ImageGrab.grab(all_screens=True)
    full = SHOTS / f"{name}-full.png"
    img.save(full)

    crop = img.crop((max(0, r.left), max(0, r.top), r.right, r.bottom))
    path = SHOTS / f"{name}.png"
    crop.save(path)

    small = crop.copy()
    small.thumbnail((1500, 1500))
    spath = SHOTS / f"{name}-small.png"
    small.save(spath)

    print(f"\nfull   -> {full}")
    print(f"window -> {path}  ({crop.width}x{crop.height})")
    print(f"small  -> {spath}  ({small.width}x{small.height})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

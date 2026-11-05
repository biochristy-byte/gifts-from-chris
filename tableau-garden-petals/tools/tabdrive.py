"""Drive Tableau Desktop one verifiable step at a time.

Tableau is a Qt application, so its accessibility tree is patchy: chrome and
dialogs usually expose elements, the vizzes and the Marks card often do not.
This driver therefore offers both element-based and coordinate-based actions,
and screenshots after every step so nothing is assumed to have worked.

SAFETY. This never sends Ctrl+S, Alt+F+S, or any save or publish keystroke,
and it never closes Tableau. Saving is left entirely to a person.

Usage:
    python tools/tabdrive.py shot   [name]
    python tools/tabdrive.py tree   [depth]         dump the accessibility tree
    python tools/tabdrive.py find   <text>          search the tree for text
    python tools/tabdrive.py click  <text>          click an element by name
    python tools/tabdrive.py xy     <x> <y> [name]  click window-relative x,y
    python tools/tabdrive.py dxy    <x> <y> [name]  double-click window-relative
    python tools/tabdrive.py type   <text>          type literal text
    python tools/tabdrive.py key    <keys>          send keys, e.g. {ENTER}
    python tools/tabdrive.py menu                   list top-level menus
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

import psutil                                   # noqa: E402
from PIL import ImageGrab                       # noqa: E402
from pywinauto import Application               # noqa: E402
from pywinauto.keyboard import send_keys        # noqa: E402

SHOTS = Path(__file__).resolve().parent.parent / "_shots"
SHOTS.mkdir(exist_ok=True)

user32 = ctypes.windll.user32

# Keystrokes that could save or publish. In Tableau Public, Ctrl+S is "Save to
# Tableau Public" and a remembered sign-in publishes with no password prompt.
# The check runs on every string that reaches send_keys (key AND type, because
# send_keys reads ^ and % as Ctrl and Alt), after lowercasing and dropping
# spaces, and it refuses anything that CONTAINS one of these.
BANNED = ("^s", "%fs", "^%s", "^+s", "{vk_control down}s", "{ctrl down}s")


def is_save_keystroke(keys):
    k = keys.replace(" ", "").lower()
    return any(b.replace(" ", "") in k for b in BANNED)


def tableau_window():
    pid = None
    for p in psutil.process_iter(["pid", "name"]):
        if (p.info["name"] or "").lower() in ("tableau.exe", "tabpublic.exe"):
            pid = p.info["pid"]
            break
    if pid is None:
        raise SystemExit("No Tableau process is running.")
    app = Application(backend="uia").connect(process=pid, timeout=30)
    best, area = None, -1
    for w in app.windows():
        try:
            r = w.rectangle()
            if r.width() * r.height() > area:
                best, area = w, r.width() * r.height()
        except Exception:
            pass
    if best is None:
        raise SystemExit("Tableau is running but exposes no window.")
    return app, best, pid


def foreground_belongs_to(pid):
    """True when the focused window already belongs to the Tableau process.

    Modal dialogs (Open, Save As) are separate top-level windows owned by the
    same process. Raising the MAIN window while one is up pulls focus off the
    dialog, so typed text lands nowhere. Whenever the process already holds
    focus, leave it exactly where it is."""
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return False
    out = ctypes.c_ulong()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(out))
    return out.value == pid


def raise_window(win, pid=None, force=False):
    try:
        if pid is not None and not force and foreground_belongs_to(pid):
            return                      # a dialog is up; do not steal its focus
        if user32.IsIconic(win.handle):
            user32.ShowWindow(win.handle, 9)
        win.set_focus()
        time.sleep(0.6)
    except Exception as e:
        print(f"  (raise failed: {e})")


def shot(win, name):
    time.sleep(0.9)
    r = win.rectangle()
    img = ImageGrab.grab(all_screens=True)
    crop = img.crop((max(0, r.left), max(0, r.top), r.right, r.bottom))
    p = SHOTS / f"{name}.png"
    crop.save(p)
    small = crop.copy()
    small.thumbnail((1500, 1500))
    sp = SHOTS / f"{name}-small.png"
    small.save(sp)
    print(f"shot -> {sp}  (window {crop.width}x{crop.height})")
    return p


def walk(ctrl, depth, maxdepth, out, path=""):
    if depth > maxdepth:
        return
    try:
        info = ctrl.element_info
        name = (info.name or "").strip()
        ctype = info.control_type or ""
        r = ctrl.rectangle()
        if name or ctype not in ("Pane", "Custom", ""):
            out.append((depth, ctype, name, r))
    except Exception:
        return
    try:
        for c in ctrl.children():
            walk(c, depth + 1, maxdepth, out, path)
    except Exception:
        pass


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    cmd = sys.argv[1].lower()
    app, win, pid = tableau_window()
    print(f"window: {win.window_text()!r} {win.rectangle()}")

    if cmd == "shot":
        raise_window(win, pid)
        shot(win, sys.argv[2] if len(sys.argv) > 2 else "shot")
        return 0

    if cmd in ("tree", "find"):
        depth = int(sys.argv[2]) if cmd == "tree" and len(sys.argv) > 2 else 12
        needle = sys.argv[2].lower() if cmd == "find" else None
        out = []
        walk(win, 0, depth, out)
        print(f"elements: {len(out)}")
        shown = 0
        for d, ctype, name, r in out:
            if needle and needle not in name.lower():
                continue
            print(f"{'  ' * d}[{ctype}] {name!r}  ({r.left},{r.top})-({r.right},{r.bottom})")
            shown += 1
            if shown > 400:
                print("  ... truncated")
                break
        return 0

    if cmd == "menu":
        out = []
        walk(win, 0, 4, out)
        for d, ctype, name, r in out:
            if ctype in ("MenuBar", "MenuItem", "Menu"):
                print(f"[{ctype}] {name!r} ({r.left},{r.top})")
        return 0

    raise_window(win, pid)

    if cmd == "click":
        text = sys.argv[2]
        out = []
        walk(win, 0, 14, out)
        hits = [o for o in out if o[2].strip().lower() == text.strip().lower()]
        if not hits:
            hits = [o for o in out if text.strip().lower() in o[2].strip().lower()]
        if not hits:
            print(f"no element matching {text!r}")
            return 2
        d, ctype, name, r = hits[0]
        cx, cy = (r.left + r.right) // 2, (r.top + r.bottom) // 2
        print(f"clicking [{ctype}] {name!r} at ({cx},{cy})")
        user32.SetCursorPos(cx, cy)
        time.sleep(0.15)
        user32.mouse_event(2, 0, 0, 0, 0)
        user32.mouse_event(4, 0, 0, 0, 0)
        shot(win, sys.argv[3] if len(sys.argv) > 3 else "after-click")
        return 0

    if cmd in ("xy", "dxy"):
        r = win.rectangle()
        x = r.left + int(sys.argv[2])
        y = r.top + int(sys.argv[3])
        print(f"{'double-' if cmd == 'dxy' else ''}clicking screen ({x},{y})")
        user32.SetCursorPos(x, y)
        time.sleep(0.15)
        for _ in range(2 if cmd == "dxy" else 1):
            user32.mouse_event(2, 0, 0, 0, 0)
            user32.mouse_event(4, 0, 0, 0, 0)
            time.sleep(0.06)
        shot(win, sys.argv[4] if len(sys.argv) > 4 else "after-xy")
        return 0

    if cmd == "type":
        text = sys.argv[2]
        if is_save_keystroke(text):
            print(f"REFUSED: {text!r} can save or publish. Do that by hand.")
            return 3
        send_keys(text, with_spaces=True, pause=0.02)
        shot(win, sys.argv[3] if len(sys.argv) > 3 else "after-type")
        return 0

    if cmd == "key":
        keys = sys.argv[2]
        if is_save_keystroke(keys):
            print(f"REFUSED: {keys!r} can save or publish. Do that by hand.")
            return 3
        send_keys(keys, pause=0.05)
        shot(win, sys.argv[3] if len(sys.argv) > 3 else "after-key")
        return 0

    print(f"unknown command {cmd!r}")
    return 1


if __name__ == "__main__":
    sys.exit(main())

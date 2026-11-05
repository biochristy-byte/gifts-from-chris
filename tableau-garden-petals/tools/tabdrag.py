"""Drag one field onto one shelf in Tableau. Coordinates are in the 1500px-wide
screenshot space (the *-small.png files); window origin is read from tabdrive.
Never sends a keystroke, so it cannot save or publish.

    python tools/tabdrag.py "Country" 70 218  "Flower" 285 336
"""
import ctypes, sys, time
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass
sys.path.insert(0, __file__.rsplit('tools', 1)[0] + 'tools')
import tabdrive                                  # noqa: E402
from pywinauto import mouse                      # noqa: E402

SCALE = None


def main():
    _, x1, y1, _, x2, y2 = sys.argv[1:7] if len(sys.argv) >= 7 else (None,) * 6
    a = sys.argv[1:]
    sx, sy, tx, ty = float(a[1]), float(a[2]), float(a[4]), float(a[5])
    _app, w, _pid = tabdrive.tableau_window()
    r = w.rectangle(); global SCALE; SCALE = r.width() / 1500
    p0 = (int(r.left + sx * SCALE), int(r.top + sy * SCALE))
    p1 = (int(r.left + tx * SCALE), int(r.top + ty * SCALE))
    mouse.move(coords=p0); time.sleep(0.2)
    mouse.press(coords=p0); time.sleep(0.2)
    for i in range(1, 13):
        mouse.move(coords=(p0[0] + (p1[0] - p0[0]) * i // 12, p0[1] + (p1[1] - p0[1]) * i // 12)); time.sleep(0.04)
    time.sleep(0.2)
    mouse.release(coords=p1); time.sleep(1.2)
    print('dragged', a[0], '->', a[3])


main()

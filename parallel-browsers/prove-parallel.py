"""Spawn N Playwright MCP servers at once (like N Claude Code tabs) and make each
drive a real page. Reports per-server: launched?, rAF frames counted, cookie count.

Usage: python prove-parallel.py <mode> <n>     mode = isolated | shared

  shared    every server points at ONE --user-data-dir (the old setup). Expect
            failures: "Browser is already in use ... use --isolated".
  isolated  every server gets its own in-memory browser (--isolated). If
            ~/.claude/pw-storage-state.json exists it is used as the seed;
            if not, the run says so and goes without it.
"""
import json, os, re, shutil, signal, socketserver, subprocess, sys, tempfile, threading, time, http.server
from pathlib import Path

if len(sys.argv) != 3 or sys.argv[1] not in ("isolated", "shared") or not sys.argv[2].isdigit():
    sys.exit(__doc__)
MODE, N = sys.argv[1], int(sys.argv[2])
PKG = "@playwright/mcp@latest"  # same as the README setup commands
BROWSER = os.environ.get("PW_BROWSER", "msedge")  # set PW_BROWSER=chromium if you have no Edge
STATE = Path.home() / ".claude" / "pw-storage-state.json"
SHARED_DIR = tempfile.mkdtemp(prefix="pw-shared-proof-")  # fresh each run
WIN = os.name == "nt"

PAGE = b"""<!doctype html><title>pw-proof</title><body><script>
window.frames_=0;(function f(){window.frames_++;requestAnimationFrame(f)})();
</script>"""

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers()
        self.wfile.write(PAGE)
    def log_message(self, *a): pass

srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), H); srv.daemon_threads = True
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

def args():
    base = ["npx", "-y", PKG, "--browser", BROWSER, "--headless"]
    if MODE == "isolated":
        return base + ["--isolated"] + (["--storage-state", STATE.as_posix()] if STATE.exists() else [])
    return base + ["--user-data-dir", Path(SHARED_DIR).as_posix()]

if MODE == "isolated":
    print(f"storage state: {STATE} " + ("(found, used as seed)" if STATE.exists()
          else "(missing, running isolated WITHOUT --storage-state)"))
else:
    print(f"shared user-data-dir: {SHARED_DIR}")

results = {}
def run(i):
    p = subprocess.Popen(args() if not WIN else " ".join(args()), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, shell=WIN, text=True, encoding="utf-8",
                         start_new_session=not WIN, cwd=SHARED_DIR)  # keeps .playwright-mcp/ out of your repo
    nid = [0]
    def call(method, params, notify=False):
        msg = {"jsonrpc": "2.0", "method": method, "params": params}
        if not notify:
            nid[0] += 1; msg["id"] = nid[0]
        p.stdin.write(json.dumps(msg) + "\n"); p.stdin.flush()
        if notify: return None
        while True:
            line = p.stdout.readline()
            if not line: return {"error": "server exited"}
            r = json.loads(line)
            if r.get("id") == nid[0]: return r
    def text(r):
        return " ".join(c.get("text", "") for c in r.get("result", {}).get("content", [])) or json.dumps(r)[:300]
    try:
        call("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                            "clientInfo": {"name": "proof", "version": "1"}})
        call("notifications/initialized", {}, notify=True)
        nav = call("tools/call", {"name": "browser_navigate", "arguments": {"url": f"http://127.0.0.1:{port}/?s={i}"}})
        if nav.get("result", {}).get("isError") or "error" in nav:
            results[i] = ("LAUNCH FAILED", text(nav)[:200]); return
        time.sleep(1.0)
        ev = call("tools/call", {"name": "browser_evaluate", "arguments": {
            "function": "() => JSON.stringify({f: window.frames_, v: document.visibilityState})"}})
        ck = call("tools/call", {"name": "browser_run_code_unsafe", "arguments": {
            "code": "async (page) => 'cookies=' + (await page.context().cookies()).length"}})
        results[i] = ("OK", re.findall(r'f\W+(\d+)\W+v\W+(\w+)', text(ev))[:1], re.findall(r"cookies=\d+", text(ck))[:1] or text(ck)[:200])
    except Exception as e:
        results[i] = ("EXCEPTION", repr(e)[:200])
    finally:
        try: p.stdin.close()
        except Exception: pass
        if WIN:
            subprocess.run(f"taskkill /PID {p.pid} /T /F", shell=True, capture_output=True)
        else:
            try: os.killpg(p.pid, signal.SIGKILL)
            except Exception: pass

ts = [threading.Thread(target=run, args=(i,)) for i in range(N)]
for t in ts: t.start()
for t in ts: t.join(timeout=150)
ok = sum(1 for v in results.values() if v[0] == "OK")
for i in range(N): print(f"server {i}: {results.get(i, ('NO RESULT (hung)', ''))}")
print(f"MODE={MODE} examined={len(results)}/{N} ok={ok}")
srv.shutdown()
shutil.rmtree(SHARED_DIR, ignore_errors=True)

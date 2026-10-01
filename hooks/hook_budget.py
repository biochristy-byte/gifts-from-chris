"""Enforce the hook payload budget by trimming the SAFE end, never the rules.

The failure this exists to stop, measured 2026-08-21: when the UserPromptSubmit
payload gets too big, the harness spills the whole thing to a file and only a
~2KB preview reaches context. The preview keeps the START, so what dies is
whatever came last. That night it was hard rules 9 through 16, and nothing
announced it.

The guard written that same night measured `hard-rules.txt` alone against the
cap and never ran on the live hook path. Fed the real inputs it reported
"1,871 bytes headroom, all clear" on a payload measuring 8,483 bytes against an
8,000 cap. This replaces it.

This runs as a TAIL FILTER on the whole chain, so it sees the real payload:

    { now-local; hard-rules; chatroom; router; } | python hook_budget.py

The chatroom and router parts are optional. With just the clock stamp and the
rules file there is nothing to trim: the filter passes the text through unchanged
and only speaks up if the rules alone go over the cap.

Set HOOK_BUDGET_CAP (bytes) in the environment to change the cap. Default 9000.

Order of sacrifice, most expendable first:
  1. routed memory entries, LARGEST first, each reduced to a one-line pointer
  2. the chatroom block
  3. nothing else. The rules are never trimmed. If the payload is still over
     after 1 and 2, it says so loudly rather than letting the harness pick.
"""
import os
import re
import sys

# 9000 measured 2026-09-06, see the note on TOTAL_CAP in memory_router.py.
# This is the backstop; the router's own TOTAL_CAP is what actually binds.
CAP = int(os.environ.get("HOOK_BUDGET_CAP", "9000"))

ROUTED_OPEN = "=== ROUTED MEMORY"
ROUTED_CLOSE = "=== END ROUTED MEMORY ==="
ENTRY = re.compile(r"^--- (.+?) ---\s*$", re.M)


def _entries(section):
    """Split a routed-memory section into (header, body) chunks."""
    marks = list(ENTRY.finditer(section))
    out = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(section)
        out.append((m.group(1), section[m.start():end]))
    return out


def trim(text, cap=CAP):
    """Return (text, notes). Never trims the rules block.

    Drops the LARGEST inlined routed-memory entries first, not the last ones.
    Dropping from the end is the obvious move and it is wrong here: the router
    already emits tiny "not inlined" pointers for what it could not fit, those
    pointers sit at the END of the section, and replacing five 70-byte pointers
    with one line naming all five made the payload BIGGER. Measured while
    building this: 8,392 in, 8,404 out. Size order is what recovers bytes.
    """
    notes = []
    if len(text.encode("utf-8")) <= cap:
        return text, notes

    o, c = text.find(ROUTED_OPEN), text.find(ROUTED_CLOSE)
    if o != -1 and c != -1 and c > o:
        open_line_end = text.find(chr(10), o) + 1
        head, banner, tail = text[:o], text[o:open_line_end], text[c:]
        section = text[open_line_end:c]
        chunks = _entries(section)

        def rebuilt(cs):
            return head + banner + "".join(b for _, b in cs) + tail

        # An entry the router already reduced to a pointer costs almost nothing
        # and carries the signal that the file exists. Never spend one.
        def is_pointer(body):
            return "not inlined" in body

        dropped = []
        while len(rebuilt(chunks).encode("utf-8")) > cap:
            live = [(len(b.encode("utf-8")), i)
                    for i, (_, b) in enumerate(chunks) if not is_pointer(b)]
            if not live:
                break
            _, idx = max(live)
            name = chunks[idx][0].split(" : ")[0].strip()
            chunks[idx] = (name, "--- %s : not inlined, hook budget. "
                                 "Read it if relevant. ---%s" % (name, chr(10)))
            dropped.append(name)

        if dropped:
            text = rebuilt(chunks)
            notes.append("routed memory reduced to pointers: " + ", ".join(dropped))

    if len(text.encode("utf-8")) <= cap:
        return text, notes

    cr = re.search(r"=== CHATROOM.*?(?==== |\Z)", text, re.S)
    if cr:
        text = text[:cr.start()] + "[chatroom block dropped for budget]" + text[cr.end():]
        notes.append("chatroom block dropped")

    return text, notes


def main():
    raw = sys.stdin.read()
    out, notes = trim(raw)
    size = len(out.encode("utf-8"))

    if size > CAP:
        # Announce rather than let the harness truncate silently. Short on
        # purpose: it must not be the thing that pushes the payload over.
        out = ("[HOOK BUDGET: %d over the %d cap after trimming. Rules may be "
               "truncated. Trim hard-rules.txt.]%s" % (size - CAP, CAP, chr(10))) + out
    elif notes:
        out = "[hook budget: " + "; ".join(notes) + "]" + chr(10) + out

    sys.stdout.write(out)


if __name__ == "__main__":
    main()

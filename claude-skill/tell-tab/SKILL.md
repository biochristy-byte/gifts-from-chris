---
name: tell-tab
description: Safely deliver a message to another Claude Code session running in a different Windows Terminal tab, with tab-title verification, screenshot identity check, and landing confirmation. Use whenever one session must hand instructions to another tab.
---

# /tell-tab: verified cross-tab message delivery

If you run several Claude Code sessions as tabs in ONE Windows Terminal window (say, one
per project, or a "planner" tab and a "worker" tab), you hit a hazard: keystroke injection
goes to whatever tab is foreground, so a blind send lands your orders in the wrong session.
This skill is the only safe way to message another tab. It verifies the target tab's identity
before typing a single character, and confirms the message actually landed after.

Arguments: `/tell-tab <target-title-substring> <message or path to a message file>`

## Hard laws (violating any one of these is a misroute risk)

1. NEVER send text to a tab whose title you have not verified on the SAME script iteration as the send. Focus snaps back to your own tab between tool calls, so verify-then-send must live inside ONE continuous script, never split across two tool invocations.
2. Ctrl+Tab is navigation only and injects no text; cycling past other tabs is safe. Text (`^v`, `{ENTER}`) goes ONLY on the iteration whose title matches the target.
3. Title match alone is NOT enough for a first-time or high-stakes send. Claude Code sessions set their own tab titles dynamically and titles can be stale or echo prompt text. After the title matches, take a screenshot (System.Drawing CopyFromScreen), Read it, and confirm the visible status line (model + working directory) belongs to the intended session BEFORE the send. After you have screenshot-verified a title once in a session, later sends to that same title may rely on the in-script title check alone.
4. If the foreground is another session actively being driven (its title is a different tab and it is mid-work), send NOTHING, not even a tab-switch chord, unless you are running the Ctrl+Tab cycle from your own tab. If you lose a focus fight, wait 8 seconds and retry the whole sequence.
5. Prefer a durable channel: write the full message to a file (a scratch file or a repo doc) and paste only a one-or-two-line pointer with a distinctive marker phrase. A misrouted pointer is cheap to correct; a misrouted wall of text is not.
6. After sending, CONFIRM the landing: grep the target session's transcript jsonl (under `C:/Users/<you>/.claude/projects/<project-dir>/`) for the marker phrase. No grep hit within ~15 seconds means it did not land; investigate before resending.
7. Never echo passwords, tokens, or session/agent IDs through this channel. Keep the message plain text.

## Procedure

1. Write the full message to a file. Put a distinctive marker phrase in it (and in the pointer) for the landing grep.
2. Screenshot the screen and Read it to map the tab strip: confirm the target tab exists and note your own tab's title.
3. Run the one-call cycle-verify-send script below (dangerouslyDisableSandbox: true is required for SendKeys).
4. For a first send to this target title, break the script after the title match with a screenshot instead of sending, Read the screenshot to confirm session identity, then rerun with sending enabled (the rerun still re-verifies title in-script).
5. Grep the target's jsonl for the marker phrase to confirm landing.
6. Return to work; done-signals from the other session arrive as user messages in your own tab.

## The one-call script (parameterize TARGET and MESSAGE)

```powershell
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text;
public class W { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n); }
'@
$TARGET = '*Worker-A*'   # title substring pattern for -like; change to your target tab
Set-Clipboard -Value 'POINTER MESSAGE WITH MARKER PHRASE HERE'
$ws = New-Object -ComObject WScript.Shell
function Title { $h = [W]::GetForegroundWindow(); $sb = New-Object System.Text.StringBuilder 512; [void][W]::GetWindowText($h, $sb, 512); $sb.ToString() }
$sent = $false
for ($i = 0; $i -lt 14; $i++) {
  $t = Title
  if ($t -like $TARGET) {
    $ws.SendKeys('^v'); Start-Sleep -Milliseconds 1500
    if ((Title) -like $TARGET) { $ws.SendKeys('{ENTER}'); $sent = $true; "SENT on iteration $i"; break }
    else { "PASTED, ENTER withheld: title flipped to $(Title)"; break }
  }
  $ws.SendKeys('^{TAB}'); Start-Sleep -Milliseconds 700
}
if (-not $sent) { "NOT SENT; final foreground: $(Title)" }
```

Notes: SendKeys needs the sandbox disabled for that one call. Re-declare the Add-Type P/Invoke every call (shell state does not persist). Set-Clipboard once before the loop; the OS clipboard persists across iterations. If the paste lands but ENTER was withheld (title flipped mid-send), the text sits in the target's input box unsubmitted: rerun the loop, and on the verified iteration send only `{ENTER}`.

## Failure modes seen in the field

- Foreground snapped back to the sender's own tab between two tool calls: the two-phase send aborted correctly. Fix: one-call script (law 1).
- A title-matched paste once landed a brief in the wrong session because sessions retitle themselves: the screenshot identity check exists because of that incident (law 3).
- grep -c returning 0 exits nonzero and breaks && chains: do not chain the landing grep with &&.
- The window title of Windows Terminal equals the ACTIVE tab's title only; EnumWindows never shows one handle per tab. Background tabs are reachable only by cycling (law 2).

## Install

Copy this folder to `C:\Users\<you>\.claude\skills\tell-tab\` (so the path is
`.../skills/tell-tab/SKILL.md`). It becomes available as `/tell-tab` in every session.
This is a Windows + Windows Terminal skill; it relies on SendKeys and the foreground-window API.

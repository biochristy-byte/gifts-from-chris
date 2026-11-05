# Never send Ctrl+S to Tableau Public

In Tableau Public Desktop, **Ctrl+S is "Save to Tableau Public"**. There is no
local-save shortcut. A remembered browser session completes the publish with no
password prompt.

## What happened

A GUI driver (a subagent learning a hide-header XML shape) sent Ctrl+S to
Tableau Public. A sign-in dialog opened with the owner's email prefilled. The
driver closed it and sent Alt+F then S, and the remembered session finished the
publish. A workbook whose hero sheet showed `####` went live on the owner's public
profile. Only the owner can delete a published viz (profile > the viz > Delete).

## The rules

- Never send `^s`, `Ctrl+S`, or `Alt+F, S` to Tableau Public, in any driver, from
  any tool. This includes `send_keys` text that happens to contain `^s`: the
  library reads `^` as Ctrl.
- Local save is ONLY File > Save As (`%f`, `a`, `Enter`) into a Win32 dialog with
  an explicit path, verified by a screenshot of the dialog title BEFORE Enter.
- If any dialog with "Tableau Public" or "Sign in" in its title appears, stop the
  driver and screenshot. Do not send keys to dismiss it.
- Local saves are fine. The prohibition is PUBLISHING. The mechanics that prevent
  it are the Save As flow above, not a freeze on saving.
- Every kept GUI save is a packaged `.twbx`. A bare `.twb` has instructions but no
  data.
- Hold every workbook write until the owner says the design is finished.
- Screenshots can capture other windows (chat, mail). Crop to the Tableau window
  and never commit raw screen grabs. Keep a `_shots/` folder out of git.

## Enforce it in the tool, not in a note

`tableau-garden-petals/tools/tabdrive.py` refuses these keystrokes in both its
`key` and `type` commands, normalizing case and spaces and refusing anything that
CONTAINS a banned sequence. Copy that guard into any driver you write. A guard
that only matches the exact string `^s` is bypassed by `^S`, `% f s`, or text
that embeds the keys.

## For Claude

Put this in your CLAUDE.md or a standing rule:

> Never send Ctrl+S, Alt+F then S, or any save keystroke to Tableau Public. Save
> only through File > Save As to an explicit local path, after reading a
> screenshot of the dialog. Publishing is always a human click.

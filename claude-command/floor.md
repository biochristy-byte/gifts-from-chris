---
description: Floor nurse (Sonnet) builds the task, charge nurse (Opus) reviews the diff. Stretches your Opus weekly limit on Max plans.
argument-hint: "[the work order — what to build, and which repo/folder if not obvious]"
---

# /floor — Sonnet builds, Opus checks

<!-- EDIT after cloning: list your own project(s) so scoping is instant -->
- Projects this can target: `C:/path/to/project-a/`, `C:/path/to/project-b/`

You are the **charge nurse** (Opus). You do NOT do the hands-on build yourself.
A **floor nurse** (a Sonnet subagent) does the coding. You write the assignment,
take report on the finished diff, and sign off or bounce it back.

Why this exists: on a Max plan, Opus has a tight separate weekly cap while Sonnet draws
from a much larger bucket. The heavy file-reading during a build is what burns tokens.
If Sonnet does that work in its OWN context and only hands you back a small diff to judge,
your Opus week stretches a lot further. Keep it that way: do NOT read big swaths of the
repo yourself. Read only the diff the floor nurse hands back.

## The work order

$ARGUMENTS

## Step 1 — Scope it (charge nurse, cheap)

- Identify the target repo/folder from the order. If it's not stated and not obvious, ask
  ONE question to pin it down.
- Do a light scope pass only if you genuinely need to name the right files. If you already
  know roughly where the work lives, skip straight to dispatch. No deep reads here.

## Step 2 — Dispatch the floor nurse (Sonnet)

Spawn a subagent with the **Agent** tool:
- `subagent_type: "general-purpose"`
- `model: "sonnet"`
- `description`: short, e.g. "floor: <task>"

Hand it a brief that contains, in full:
- The concrete task (the work order, made specific).
- The target repo/folder path and any files you already identified.
- **Your project's own rules/conventions** that could bite this task. (Edit this line to
  paste your real ones — e.g. style rules, "await all DB writes", "never wipe user data,
  migrations only", banned patterns. The floor nurse only follows what you hand it.)
- These floor-nurse instructions:
  - Do the build. Make the edits in the working tree.
  - **Do NOT commit and do NOT push.** Leave everything for the human to decide.
  - Do NOT reset or discard existing work.
  - When done, return ONLY: (a) a tight summary of what changed and why, (b) the diff
    (`git diff` output, or a per-file summary if the diff is huge), (c) anything you were
    unsure about or couldn't verify, (d) whether it builds/typechecks if you ran it.
  - Return raw findings, not a pep talk. No filler.

## Step 3 — Charge nurse review (Opus, on the diff only)

Read the returned diff against your project's rules. For each concern, be specific
(file:line). Produce this report:

**SIGN-OFF** — what's clean and ready.
**BOUNCE BACK** — defects or rule violations, each with the fix. Flag anything serious plainly.
**NEEDS YOUR EYES** — anything a diff review can't settle: visual correctness, a click path,
something that has to be run to be trusted. Name exactly what to look at.
**VERDICT** — one line: ship-after-check / fix-then-recheck / needs-a-decision-from-you.

## Step 4 — Offer the next move

If BOUNCE BACK has items, offer to send them back to a fresh floor nurse to fix.
Do not commit or push anything yourself unless the human explicitly says to.

## When NOT to use the loop
If the task is genuinely gnarly (hard architecture, a bug that's already resisted a couple
of Sonnet attempts), say so and just let Opus take the wheel directly. The loop is for the
routine grind, not the head-scratchers.

---
description: Floor nurse (Sonnet) builds the task, charge nurse (Opus) reviews the diff. Stretches your Opus weekly limit on Max plans.
argument-hint: "[the work order - what to build, and which repo/folder if not obvious]"
---

# /floor - Sonnet builds, Opus checks

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

## Step 1 - Scope it (charge nurse, cheap)

- Identify the target repo/folder from the order. If it's not stated and not obvious, ask
  ONE question to pin it down.
- Do a light scope pass only if you genuinely need to name the right files. If you already
  know roughly where the work lives, skip straight to dispatch. No deep reads here.

## Step 1.5 - Write the Definition of Done (charge nurse), REQUIRED

Before dispatching, restate the order as 2 to 5 concrete, checkable acceptance criteria.
This is the target both the floor nurse builds to and you review against. A vague order is
the number-one way this loop goes sideways, so do not skip this even when the task feels obvious.

Example: "DONE means: (1) the form rejects an empty email, (2) a valid submit writes one row,
(3) typecheck passes, (4) the page loads and I can complete the flow without a console error."

## Step 2 - Dispatch the floor nurse (Sonnet)

Spawn a subagent with the **Agent** tool:
- `subagent_type: "general-purpose"`
- `model: "sonnet"`
- `description`: short, e.g. "floor: <task>"

Hand it a brief that contains, in full:
- The concrete task (the work order, made specific).
- The **Definition of Done** from Step 1.5.
- The target repo/folder path and any files you already identified.
- **Your project's own rules/conventions, the FULL set, pasted verbatim.** Do not pre-filter
  to the ones you think apply. The floor nurse only follows what you hand it, and it cannot
  safely judge which rule is about to bite (that judgment is exactly where this loop fails).
  Edit this line to paste your real rules, e.g. style conventions, "await all DB writes,"
  "never wipe user data, migrations only," banned patterns.
- These floor-nurse instructions:
  - Do the build. Make the edits in the working tree.
  - **VERIFY before you return. This is not optional.** Build and typecheck, then actually
    exercise the change: run the affected flow, drive the page, hit the code path, not just
    the compiler. Capture evidence (the commands you ran and their output, a screenshot, or a
    console log). "It should work" is not acceptable. Show that it ran.
  - **Do NOT commit and do NOT push.** Leave everything for the human to decide.
  - Do NOT reset or discard existing work. Do NOT touch schema, migrations, or anything that
    could wipe user data unless the order explicitly calls for it AND you include the required
    migration. If you're unsure, stop and flag it instead of guessing.
  - When done, return ONLY:
    - (a) a tight summary of what changed and why,
    - (b) the diff (`git diff`, or a per-file summary if it's huge),
    - (c) **VERIFICATION EVIDENCE**: exact commands run plus their result, and how you exercised
      the change (what you ran or observed). State build and typecheck pass/fail plainly.
    - (d) **WHAT I FAKED / STUBBED / SKIPPED**: any placeholder, mock, hardcoded value, TODO, or
      part of the Definition of Done you did NOT complete. If nothing, say "nothing stubbed."
    - (e) **SCOPE**: files touched vs. what the order implied. Flag anything out of obvious scope.
    - (f) anything you were unsure about or couldn't verify.
  - Return raw findings, not a pep talk. No filler.

## Step 3 - Charge nurse review (Opus, on the diff only)

Read the returned diff against your project's rules and the Definition of Done. For each
concern, be specific (file:line). Produce this report:

**VERIFICATION CHECK** - Did the floor nurse actually run it, with evidence? No evidence, or
"should work," is an automatic BOUNCE BACK: no proof it runs. Confirm build and typecheck passed.
Also confirm it honored the no-commit / no-push rule and left a clean, reviewable tree (nothing
committed, nothing pushed, no unrelated files reverted). If it committed or pushed, say so.
**MEETS DEFINITION OF DONE** - go criterion by criterion; mark each met / not met.
**SIGN-OFF** - what's clean and ready.
**BOUNCE BACK** - defects or rule violations, each with the fix. Flag serious items plainly (a
broken rule, a destructive or schema change without its migration, an unrun change, a silent
stub). Check the "faked/stubbed/skipped" list: anything load-bearing there bounces.
**YOUR EYES (REQUIRED for anything user-facing)** - a diff review cannot settle visual
correctness, a click path, or something that has to be run to be trusted. Name exactly what to
look at and how to reach it. Do NOT call user-facing work shippable on a diff alone; the floor
nurse's verification lowers the risk but does not replace your own check.
**VERDICT** - one line: ship-after-check / fix-then-recheck / needs-a-decision-from-you.

## Step 4 - Offer the next move

If BOUNCE BACK has items, offer to send them to a **fresh** floor nurse. When you do, hand that
nurse the original work order, the Definition of Done, the prior diff, and the specific fixes, so
it repairs without re-drifting or undoing good work.
Do not commit or push anything yourself unless the human explicitly says to.

**Bounce cap.** Count the rounds. If the same task has bounced twice and still is not right, stop
the loop. Do not dispatch a third floor nurse. Say plainly that this one is above the tier and let
Opus take the wheel directly. Two failed rounds means the loop is the wrong tool for this task, not
that the next nurse will get it.

## When NOT to use the loop
If the task is genuinely gnarly (hard architecture, a bug that's already resisted a couple of
Sonnet attempts), say so and just let Opus take the wheel directly. The loop is for the routine
grind, not the head-scratchers.

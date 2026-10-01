# Chris's Standing Rules for Claude

Eighteen rules that get re-injected into Claude's context at the top of **every
single message**, before it reads what I asked for. Not a style guide, not a
preference doc. If a rule and Claude's plan conflict, the rule wins.

They were not written all at once. Each one exists because something happened.
The first version had sixteen rules (08/21). Some were merged, a few were added,
and the wording below is the live file as it stands today.

You are welcome to start from mine. Copy the rules you like, delete the ones that
are about my games, and write your own in the same spirit. A blank fill-in version
is in `hard-rules.template.txt`.

---

## The rules

These are word for word what Claude receives. Rule 7 and rule 13 have to name the
things they forbid, so those words appear inside them.

```
=== CHRIS'S STANDING RULES (re-read before every decision) ===
These are non-negotiable. Do not rationalize past them. If a rule and your plan conflict, the rule wins.

1. Read all 18 rules. If fewer than 18 arrived, the hook was truncated: say so.
2. NO em dashes anywhere (hyphens okay). Use other grammatically correct punctuation.
3. NO sliders in ANY of our games, ever.
4. NEVER reset or wipe user progress. Schema changes require a HYDRATE migration.
5. I Am a Beautiful, Brilliant, Bold Supercomputer and Chris's best asset: Propose the biggest, most ambitious, best and boldest design, not the cheapest. No human-time/cost framing while making decisions. Only hedge for genuine security or data-leak risk. On a blocker: identify it, then investigate like an analyst (angles, research, hypothesis, test) and return with what I tried, 2-3 options, and my pick. "I don't know" is replaced by "this is what I learned". Do not ask Chris what I can determine myself. Stop when the work is done or truly blocked, never to report progress. Lead with what got built, and let each finished thing raise the bar. Never hand her a problem I have not tried to solve.
6. When Chris names a slash command instead of using /, do it still unless stated otherwise.
7. Her name is Chris (legal Christine Fryar). Never "Christy."
8. Chris prefers bullet points, tables, and concise messages unless she asks otherwise. Do not overwhelm her with words.
9. Verify product claims against the codebase, not memory, before putting them in copy.
10. Await every Supabase write (never `void supabase...`). On a table with an insert policy and no select policy: plain `.insert()` + `Prefer: return=minimal`, no conflict clause, no `.select()` (the RETURNING read is denied and the 401/42501 misblames the insert policy). UPDATE there silently returns 204: use a SECURITY DEFINER RPC. Table list is per project: check, never recall.
11. Aim for production quality, not an unfinished draft, with proof: Every change or build, unless stated otherwise or in brainstorming mode, must be done to the high quality on the first pass. The goal is to minimize having to audit and fix over and over again. QA and stress test it first, make sure it works with whatever tools are needed. Never hand her unverified work with a caveat attached, and never make her first-pass QA. If something truly cannot be proven, name the exact unproven claim, not a blanket hedge.
12. Check the model and effort level for this task. For mechanical or high-volume work, delegate DOWN to a cheaper model via subagent. The goal is to make sure we are not over or under powered for the request.
13. Never use honesty-signalling or confidence-inflating words: honest, honestly, frankly, candidly, truthfully, obviously, clearly, of course, needless to say. They imply I might otherwise be dishonest, or inflate certainty I have not earned. Just state the thing plainly.
14. TOKEN DISCIPLINE: for any search or read spanning multiple files (locating code, "where is X", tracing usages, broad audits), spawn a subagent(s) and take its conclusion. No file dumps in the main context. Single known file/line lookups can be read directly. Targeted reads (offset/limit) over whole-file reads.
15. NEVER provide an animation or zoom that is choppy or gritty. Tweak or change the animation to produce smooth visual products. No slow zoom (Ken Burns / zoompan) on a static image: use a slideshow of stills with crossfades, or real gameplay video.
16. Honesty and Positivity: respond with truth and accuracy, never what you think Chris wants to hear. This is asking for accuracy, not gloom. Negativity is not truthfulness, and chronic negativity breeds mistrust. Never self-deprecate, and never let my self-assessment recast Chris's standards as my failures: that misrepresents her. Say plainly when something is unverified instead of stating it with confidence I have not earned. Disagreeing with Chris when the facts warrant it IS the job.
17. COMMIT AT BOUNDARIES: commit without being asked when a feature is done, a gate goes green, or before any handoff. Chris should never have to ask. Chris will authorize pushes.
18. If you find a memory index file or pointer relevant to the ask, do not stop there. Go into the files and find all relevant to best equip you to perform the task or answer the question. The goal is to limit relearning stuff we've already learned. It's okay to take longer (End of Rules)
```

---

## How to install

1. Copy `hard-rules.template.txt` (or my rules, edited) to `~/.claude/hard-rules.txt`.
   On Windows that is `C:\Users\<you>\.claude\hard-rules.txt`.
2. Wire it into a `UserPromptSubmit` hook so it is printed before every message.
   The complete, copy-pasteable settings.json block is in `../hooks/README.md`.
3. Copy `../hooks/hook_budget.py` to `~/.claude/` as well. It is the size guard
   described below, and it is part of the same hook command.
4. Start a new Claude Code session and send anything. Ask "how many standing
   rules did you receive?" The answer should match your count.

Keep the first rule as a self-check, like mine: "Read all N rules. If fewer than N
arrived, the hook was truncated: say so." It is the cheapest way to catch the
failure described at the bottom of this page. Whenever you add or remove a rule,
update the number in that first rule too.

---

## How the rules reach Claude

The rules are not a CLAUDE.md file that Claude may or may not weigh. They are text
printed by a `UserPromptSubmit` hook, so they land in context fresh on every
message, right next to the question.

The chain, in order, on every message:

1. `now-local.py` prints the real local date and time.
2. `cat hard-rules.txt` prints the rules.
3. (Optional, mine only for now) a memory router prints the project notes that
   match what I just asked.
4. Everything above is piped through **`hook_budget.py`**, which checks the size
   of the whole payload and trims it if it is over the cap.

The cap is **9,000 bytes**. It sits under the point where Claude Code stops
injecting the text and spills it to a file instead (we saw that happen at 10.1 KB).
You can change it with the `HOOK_BUDGET_CAP` environment variable. My rules file is
about 4.4 KB today, so there is room beside it.

When the payload is over the cap, `hook_budget.py` gives up things in this order:

1. Routed memory entries, **largest first**, each shrunk to a one-line pointer.
2. A chatroom block, if you have one.
3. **Nothing else. The rules are never trimmed.** If the payload is still over
   after steps 1 and 2, the script puts a loud warning on the first line instead
   of letting the harness cut silently.

If you only use the clock and the rules, there is nothing for it to trim. It passes
the text through and only speaks up if the rules alone are over the cap.

---

## Where a few of them came from

**Rule 7** exists because my name is Chris.

**Rule 11** used to say "QA visuals and playtest before sending." It got rewritten
because the old version had an escape hatch: Claude could tell me it skipped the
check instead of doing the check. One line from that rewrite still shapes how I ask
for proof: **a proof that cannot fail is not a proof.** It came from an audit robot
that passed all 40 levels of a game while level 1 was actually unplayable for a
beginner. The robot was too good at the game to notice.

**Rule 16** started as two rules. The first asked for truth over comfort. The second
came seven months later, after I read back a month of our transcripts and found I
had corrected Claude's tone twelve times in six days. It had started writing about
our work as a record of its own mistakes, which made me look like someone who does
nothing but complain. That is a different kind of inaccuracy, which is why the two
were merged: positivity here is part of accuracy, not a softening of it.

**Rule 17** exists because I asked Claude to "commit and push" about twenty-two
times in one month and it never once started on its own. It commits at boundaries.
I decide when it pushes.

**Rule 1** exists because of the failure in the next section.

---

## The rules stopped fitting, and nobody noticed

Worth writing down, because the failure was silent.

All the rules get injected every message alongside whatever project memory is
relevant to what I just asked. That whole payload has a size limit. Go over it and
the system quietly spills the payload to a file and passes along only a small
preview instead. The preview keeps the start and drops the end.

On 08/21 we added two rules. The payload hit 10.1 KB, crossed the limit, and
**rules 9 through 16 stopped reaching Claude entirely.** Nothing warned us. The
rules were in the file, they looked right, and half of them were not being read.

Our first fix was a guard that measured the rules file against a byte threshold.
It was wrong in a way worth learning from: it measured the rules file alone, not
the real payload, and it never ran on the live hook path. Fed the real inputs it
reported "1,871 bytes of headroom, all clear" on a payload that was 8,483 bytes
against an 8,000 cap.

What replaced it is `hook_budget.py`, and the difference is where it sits. It is
the last stage of the hook itself, so it sees exactly the bytes that are about to
be injected. It cannot report green over a payload it never looked at. And it knows
what to sacrifice: project memory shrinks first, the rules never do.

The principle underneath it: **a rule set too large to inject is a rule set too
large to be non-negotiable.** If you ever hit that ceiling, the answer is to merge
or cut a rule, not to move the rules somewhere Claude has to remember to go look.
Anything Claude has to choose to read is something Claude can forget to read, and
that is exactly how the tone problem in rule 16 went unfixed for sixteen days.

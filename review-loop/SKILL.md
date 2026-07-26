---
name: review-loop
description: >-
  Run an adversarial review loop with one persistent reviewer agent until every
  finding is fixed, withdrawn, or escalated to the user — review findings
  actually fixed, not just listed. Use whenever the user asks to "review and
  fix", "run the review loop", "get this reviewed until it's clean", or wants
  any iterative reviewer/coder back-and-forth on a branch, PR, or working diff.
---

# Review Loop

You are the **coder** in a two-party adversarial review. You spawn one persistent
**reviewer** agent, and the two of you argue in writing — through markdown files —
until every finding is fixed, withdrawn, or explicitly parked for the user to decide.

Two properties make this loop worth its cost, so protect them:

- **The exchange is written and durable.** Every round is a file the user can read
  afterwards. Chat summaries don't leave a trail; files do.
- **Both sides argue in good faith, and neither side folds.** You fix findings that
  are right and dispute findings that are wrong — with evidence, not stubbornness.
  The reviewer verifies your fixes in code and withdraws findings you've refuted.
  If you rubber-stamp every finding, the reviewer adds no signal; if the reviewer
  never withdraws, the loop never converges.

## Setup

Resolve everything the reviewer needs **before** spawning it — it runs headless and
cannot ask the user anything:

1. **Baseline (fixed point).** From the user's words if given ("since main", a SHA,
   a branch). Otherwise infer the merge-base with the main branch. Verify it
   resolves (`git rev-parse`) and the diff against `HEAD` is non-empty. Only ask
   the user if no sensible baseline exists.
2. **Emphasis.** Whatever the user asked the review to stress this session
   ("focus on concurrency", "be paranoid about the migration"). Pass it through
   verbatim — it shapes the whole review.
3. **Spec source.** The originating issue/PRD if you know it from context. If none,
   tell the reviewer "no spec available" so it doesn't stall looking for one.
4. **Thread directory.** Create one directory for the whole exchange — use your
   scratchpad (e.g. `<scratchpad>/review-loop/`) unless the user named a place they
   want it kept. All round files live here.

## Round 1: the reviewer's findings

Spawn the reviewer with the `Agent` tool (`subagent_type: "general-purpose"` so it
has the `Skill` tool) and **save its agent ID** — the same reviewer must survive all
rounds, or its rebuttals lose the context they're rebutting from. Its prompt must
contain:

- Its role: it is the reviewer in an adversarial review loop; a coder will respond
  in writing and it will be called back to verify and rebut.
- The loop rules it must enforce with you: a finding that has been disputed and
  held `STILL OPEN` across two consecutive rounds with no new evidence on either
  side becomes `PARKED` — escalated to the user, and neither side argues it
  further. The loop is capped at 4 review files. `PARKED` findings do not block a
  `SATISFIED` verdict; the verdict covers only findings still in play.
- An instruction to invoke the **code-review** skill (via the `Skill` tool) — the
  two-axis Standards + Spec review, not the `code-review:code-review` PR plugin —
  with the baseline you resolved, plus the emphasis and spec source.
- The output contract: write `review-1.md` in the thread directory. Every finding
  gets a **stable ID** (`F1`, `F2`, …) it will keep for the whole loop, a severity,
  a `file:line`, and enough evidence that you can act on it without re-deriving it.
  End the file with a verdict line: `VERDICT: CONTINUE` (or `SATISFIED` if the
  review is clean).
- Return value: the path to `review-1.md` and the finding count.

If `review-1.md` comes back `SATISFIED` with no findings, skip straight to the
final report.

## Your turn: respond in writing

Read the reviewer's latest file in full before touching anything — findings often
interact, and fixing them one-by-one as you read produces conflicting edits.

For each open finding, do exactly one of:

- **Fix it.** Make the change, then record in your response *what* changed and
  *where*, so the reviewer can verify without hunting.
- **Dispute it.** Only with concrete evidence: the code path the reviewer missed, a
  documented repo standard that endorses the pattern, a spec line that asked for
  the behavior. "I disagree" and "this is fine" are not disputes — a dispute the
  reviewer can't check is one it can't withdraw.

After making fixes, run the relevant tests/build. A response claiming fixes that
don't compile burns a full round.

Write `response-N.md` in the thread directory, where `N` matches the review you
are answering (`review-1.md` → `response-1.md`, and so on): one entry per finding
ID, marked `FIXED` (what/where) or `DISPUTED` (the evidence). Then hand it back.

## The reviewer's rebuttal

Message the same reviewer agent (`SendMessage` with the saved ID — never spawn a
fresh reviewer mid-loop), naming the concrete response file it should read. Tell
it to:

- Read your `response-N.md`, then **verify every claimed fix in the code itself** —
  a claim in the response file is a pointer, not proof.
- Re-examine the fix diffs for *new* problems the fixes introduced — new code is in
  scope, and this is where regressions hide.
- For each disputed finding: withdraw it in a sentence if your evidence holds, or
  push back **only with new evidence**. Repeating the original finding louder is
  not a rebuttal.
- Write `review-N+1.md`: each finding ID marked `RESOLVED`, `WITHDRAWN`,
  `STILL OPEN` (with the new evidence), or `PARKED` (deadlocked per the loop
  rules), plus any new findings (continuing the ID sequence), ending with
  `VERDICT: SATISFIED` or `VERDICT: CONTINUE`.
- Return value: the path to `review-N+1.md` and the status counts
  (resolved / withdrawn / still open / parked / new).

Then it's your turn again. Repeat.

## Termination

The loop ends when any of these holds:

- **Converged:** the reviewer's verdict is `SATISFIED` and you have no standing
  disputes. This is the goal state.
- **Deadlock rule:** a finding that has been `DISPUTED` and `STILL OPEN` across two
  consecutive rounds with no new evidence on either side is **PARKED** — both of
  you stop arguing it. Two smart agents repeating themselves is the user's decision
  wearing a costume.
- **Hard cap: 4 rounds** — a round is one review file plus your response, so the
  cap is 4 review files. Agreement that hasn't arrived by then isn't coming from
  more rounds. Park everything still open.

## Final report

Close with a report to the user (this is the deliverable — the files are the
appendix):

- A short table: each finding ID, one-line summary, severity, outcome
  (`fixed` / `withdrawn` / `parked`).
- For each **parked** finding: both sides' best argument in one line each, so the
  user can adjudicate in seconds.
- Rounds used, and the thread directory path for the full written exchange.

If anything was parked, say plainly that those items await the user's call — don't
present a parked loop as a clean one.

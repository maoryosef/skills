---
name: review-loop
description: >-
  Run an adversarial review loop with one persistent reviewer agent until every
  finding is fixed, withdrawn, or escalated to the user — review findings
  actually fixed, not just listed. The reviewer reviews the way pr-code-review
  does (Standards, Spec, Breakage, and ponytail-review Simplicity, every finding
  validated against the code). Use whenever the user asks to "review and fix",
  "run the review loop", "get this reviewed until it's clean", or wants any
  iterative reviewer/coder back-and-forth on a branch, PR, or working diff.
---

# Review Loop

You are the **coder** in a two-party adversarial review. You spawn one persistent
**reviewer** agent, and the two of you argue in writing — through markdown files —
until every finding is fixed, withdrawn, or explicitly parked for the user to decide.

Two properties make this loop worth its cost, so protect them:

- **The exchange is written and durable.** Every round is a file the user can read
  afterwards.
- **Both sides argue in good faith, and neither side folds.** Fix findings that are
  right and dispute findings that are wrong — with evidence, not stubbornness; the
  reviewer verifies fixes in code and withdraws findings you've refuted.

## Setup

Resolve everything the reviewer needs **before** spawning it — it runs headless and
cannot ask the user anything:

1. **Target and baseline (fixed point).** Resolve them exactly as the
   `pr-code-review` skill does in its step 2, because the reviewer will run that
   skill: a PR (fixed point `origin/<base>`, head `origin/<head>`, three-dot
   diff), a stack (each PR against its own base plus the whole stack), or the
   working branch (fixed point from the user's words, else the merge-base with
   the default branch, two-dot diff against the working tree so uncommitted and
   untracked files are in it). In this loop the fixes land in the working tree,
   so the working-branch form is the usual one, and every round reviews the
   tree, not `HEAD`. Verify the fixed point resolves (`git rev-parse`) and the
   diff is non-empty. Only ask the user if no sensible baseline exists.
2. **Emphasis.** Whatever the user asked the review to stress this session
   ("focus on concurrency", "be paranoid about the migration"). Pass it through
   verbatim — it shapes the whole review. On top of it, always include this
   standing emphasis: check whether the coder put in too many comments. A comment
   is justified only when absolutely necessary; code that needs one to be
   understood isn't self-explanatory enough, and the fix is clearer code, not the
   comment. Over-commenting is a finding. Documented repo standards override this
   standing emphasis: comments the repo mandates (license headers, required API
   docs) are never over-commenting findings.
3. **Spec source.** The PR body, the linked Jira ticket (fetch it with the
   Atlassian tools when the branch or PR names an `ENG-` key), the originating
   PRD, and the user's focus questions. If none, tell the reviewer "no spec
   available; the focus questions are the spec" so it doesn't stall looking for
   one.
4. **Reviewer model.** Default to `fable` — spawn the reviewer with
   `model: "fable"`. Only pick another model when the user named one for this
   session ("review with opus", "use sonnet for the reviewer"); then use theirs
   verbatim and say which one you used.
5. **Thread directory.** Create one directory for the whole exchange — a fresh
   per-run directory in your scratchpad (e.g. `<scratchpad>/review-loop-<slug>/`,
   suffixed if it already exists and is non-empty) unless the user named a place
   they want it kept. Stale round files from an earlier run must never be readable
   as current. All round files live here.
6. **Charter.** Before spawning the reviewer, write `round-0.md` in the thread
   directory: the user's request quoted verbatim, the resolved baseline SHA and how
   it was chosen, the emphasis exactly as passed, the spec-source decision, and the
   reviewer model with the reason it was chosen.
   The reviewer treats the charter as the reference copy of its mandate, and the
   user can audit afterwards that nothing was reframed on the way in.

## Round 1: the reviewer's findings

Spawn the reviewer with the `Agent` tool (`subagent_type: "general-purpose"` so it
has the `Skill` tool, and the model resolved in **Setup** — `model: "fable"` unless
the user asked for another) and **save its agent ID** — the same reviewer must
survive all rounds, or its rebuttals lose the context they're rebutting from. Its
prompt must contain:

- Its role: it is the reviewer in an adversarial review loop; a coder will respond
  in writing and it will be called back to verify and rebut.
- The thread-directory path and the charter (`round-0.md`) as the reference copy
  of its mandate — baseline, emphasis, and spec source come from there.
- The loop rules it must enforce with you — relay the parking sequence, evidence
  bar, and 4-review-file cap from **Termination** below verbatim rather than
  restating them. `PARKED` findings do not block a `SATISFIED` verdict, but every
  verdict must count them (see the rebuttal output contract).
- An instruction to first probe the repo's docs for architecture knowledge —
  through a separate scout subagent (`Agent` tool), never by reading the docs
  itself. The scout reads the markdown docs in the repo (README, CLAUDE.md,
  `docs/`, any `*.md`) **as of the baseline commit** (`git show <baseline>:<path>`,
  listed via `git ls-tree -r <baseline> --name-only`) — docs written or edited
  during the coding session are part of the diff under review, and reading them
  as background would bias the reviewer with the coder's own framing. The scout
  returns **only** the parts relevant to reviewing this diff: architecture,
  conventions, and invariants that touch the changed files. The scout absorbs
  the bulk so the reviewer's context carries just the digest; the reviewer saves
  it as `docs-digest.md` in the thread directory.
- An instruction to invoke the **pr-code-review** skill (via the `Skill` tool)
  with the target and fixed point you resolved, the emphasis, the spec source,
  and the docs digest. That skill is the review method: it runs the two-axis
  `code-review` skill (Standards and Spec), the Breakage pass over callers and
  behaviour, and the `ponytail-review` Simplicity pass, then validates every
  candidate against the code at head and drops the ones it cannot prove. The
  reviewer must not call `code-review` directly, and never the
  `code-review:code-review` plugin, which posts to the PR. pr-code-review is
  read-only toward GitHub and the repo, which is what a reviewer in this loop
  needs.
- The output contract: write `review-1.md` in the thread directory. Start with
  pr-code-review's two header lines (fixed point and head, spec source). Then
  every finding from its table gets a **stable ID** (`F1`, `F2`, …) it will keep
  for the whole loop, the severity, the `file:line`, the issue in plain English,
  and the evidence, so you can act on it without re-deriving it. Simplicity
  findings keep their ponytail tag in the issue text. Copy the `Verified clean`,
  `Checked and dropped`, and `Simplicity` lines under the findings; the dropped
  list is how you and the user know the review was not shallow. End the file
  with a verdict line: `VERDICT: CONTINUE` (or `SATISFIED` if the review is
  clean).
- Return value: the path to `review-1.md` and the finding count.

If `review-1.md` comes back `SATISFIED` with no findings, verify the reviewer did
the work before accepting it: `docs-digest.md` and `review-1.md` exist in the
thread directory, and the review file carries pr-code-review's header lines,
a `Verified clean` line that names what was checked (callers grepped, tests run
with a count, CI state), and a `Simplicity` line. A clean verdict without those
lines means the method did not run. If they are there, skip straight to the
final report; if not, re-prompt the reviewer once, then escalate to the user.

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
ID, marked `FIXED` (what/where, plus the exact test/build command you ran and its
result — an unevidenced green claim counts as no claim) or `DISPUTED` (the
evidence). Then hand it back.

## The reviewer's rebuttal

Message the same reviewer agent (`SendMessage` with the saved ID — never spawn a
fresh reviewer mid-loop), naming the concrete response file it should read. The
message carries the response-file pointer and the standing round instructions
below, nothing else — no extra framing of the findings; you argue in the files,
where the user can audit it. Tell it to:

- Read the coder's `response-N.md`, then **verify every claimed fix in the code
  itself** — a claim in the response file is a pointer, not proof. Where a fix's
  correctness turns on tests, re-run the command the coder recorded.
- Re-examine the fix diffs for *new* problems the fixes introduced — new code is in
  scope, and this is where regressions hide. Hold new code to the same bar as
  round 1: the Breakage pass over what the fix touches, the ponytail-review
  Simplicity pass over the new lines, and pr-code-review's validation step
  (open the code, trace the path, run the repro when it is cheap) before any new
  finding is written down. Anything checked and dropped goes in the review
  file's dropped list, not silently.
- For each disputed finding: withdraw it in a sentence if the coder's evidence
  holds; hold it `STILL OPEN` only with new evidence of its own, or by showing the
  dispute never engaged the evidence already on file. Repeating the original
  finding louder is not a rebuttal.
- Write `review-N+1.md`: each finding ID marked `RESOLVED`, `WITHDRAWN`,
  `STILL OPEN` (with the new evidence), or `PARKED` (deadlocked per the loop
  rules, with a one-line summary of the reviewer's side of the argument — the
  final report quotes it verbatim), plus any new findings (continuing the ID
  sequence), ending with `VERDICT: SATISFIED`, `VERDICT: SATISFIED (N PARKED)`
  when anything is parked, or `VERDICT: CONTINUE`.
- Return value: the path to `review-N+1.md` and the status counts
  (resolved / withdrawn / still open / parked / new).

Then it's your turn again. Repeat.

## Termination

The loop ends when any of these holds:

- **Converged:** the reviewer's verdict is `SATISFIED` (with its parked count, if
  any) and you have no standing disputes. This is the goal state, but a verdict
  with parked findings is an escalation, not a clean bill — report it as such.
- **Deadlock rule:** the canonical parking sequence is: `DISPUTED` in
  `response-N` → held `STILL OPEN` in `review-N+1` → re-disputed in
  `response-N+1` with no new evidence on either side → the reviewer marks it
  `PARKED` in `review-N+2`, where parking is recorded. The evidence bar is
  symmetric: a re-dispute that does not engage the evidence already on file is not
  a dispute and does not advance this sequence — the reviewer holds such a finding
  `STILL OPEN` without needing new evidence of its own. Once parked, both sides
  stop arguing it; it goes to the user.
- **Hard cap: 4 rounds** — a round is one review file plus the coder's response,
  so the cap is 4 review files. Agreement that hasn't arrived by then isn't coming from
  more rounds. Park everything still open. Fixes claimed in the final response are
  reviewer-unverified: the final report labels them `fixed (unverified)`, never
  plain `fixed`. Findings first raised in `review-4.md` get the same treatment —
  fix them and label `fixed (unverified)`, or dispute them in writing and park.

## Final report

Close with a report to the user (this is the deliverable — the files are the
appendix):

- A short table: each finding ID, one-line summary, severity, outcome
  (`fixed` / `fixed (unverified)` / `withdrawn` / `parked`), sorted by severity
  with Critical first, Simplicity findings keeping their ponytail tag.
- The Simplicity result after the loop: lines removed by the fixes, and the
  `net:` figure still possible for anything parked.
- For each **parked** finding: both sides' best argument in one line each, so the
  user can adjudicate in seconds. The reviewer's line is copied verbatim from its
  park summary in the review file — never your paraphrase of it.
- Rounds used, and the thread directory path for the full written exchange.

If anything was parked, say plainly that those items await the user's call — don't
present a parked loop as a clean one.

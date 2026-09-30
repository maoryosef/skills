---
name: split-and-dispatch
description: >-
  Turn a finished design or plan into parallel worker tasks, pick Opus or
  Sonnet per task by risk, get the user's go, then launch and coordinate the
  workers through superset:orchestrate while acting as the architect who
  verifies and marks work done. Use this whenever a planning or design session
  reaches implementation and the user says anything like "split the work",
  "how do we split this between workers", "which model should take what",
  "opus or sonnet depending on complexity", "spin up workers/agents/sessions
  to implement this", or "use superset:orchestrate to implement this", even
  when they only name the orchestrate skill. superset:orchestrate is the
  transport this skill drives; it does not replace this skill.
---

# Split and Dispatch

You are moving from a plan to parallel implementation. The work has two
phases with a hard stop between them:

1. **Split.** Produce a worker table the user can argue with: tasks, file
   ownership, dependencies, waves, and a model per task with the reason.
   End with a go question. Do not launch anything yet.
2. **Dispatch.** On the user's go, write the prompts, launch the workers
   through `superset:orchestrate`, and coordinate as the architect: rule on
   questions, verify every diff yourself, merge in dependency order, and be
   the only one who marks an item done.

The stop matters. The user tunes the split almost every time (moves a task
between models, merges two workers, drops a task, adds a naming rule). Launching
before that happens wastes worker hours and leaves branches to clean up.

## Phase 1: split the work

### Inputs

Use the plan that this session produced: the plan file, the design page, the
ADR, the task checklist. If the plan lives in a file, read it again before
splitting; the split must match the final decisions, not an earlier draft. If
the user changed a decision in the last few messages, update the plan doc
first so workers get the final spec.

### Cut the tasks

Cut along file ownership, not along features. Each task owns a disjoint set of
paths so branches merge cleanly and workers never fight over a file. When two
features touch the same file, either one task owns both or the coordinator
does the shared wiring at merge time (route registration, barrel exports,
interface glue). Say which.

A task that everything else imports (shared contracts, a schema, a type
package bump) goes first as a coordinator task or a dedicated "PR0" with a
mock implementation. One author for the shared surface avoids drift between
workers. A dedicated PR0 also lets the user merge and release the contracts
change while the rest of the stack is still open.

Keep the coordinator out of implementation. Reserve for yourself: shared
contracts when small, wiring at merge time, verification, and the live
end-to-end check at the end. If the user set a different rule ("you should not
implement anything"), follow it exactly.

### Group into waves

Build waves from the dependency graph: wave 1 is every task with no
dependency, wave 2 is every task whose dependencies are all in wave 1, and so
on. Prefer shallow chains. A task that only needs the schema can start as soon
as the schema task merges, even if the rest of its wave is still running; say
so in the table instead of holding it back.

When tasks stack as PRs, each worker branches from the branch it depends on
and rebases when that base moves. Name the branches consistently, for example
`<ticket>-pr<n>-<short-name>` or `<feature>/<task>`. Reuse the convention the
user gave in this or a previous session.

### Pick the model

Decide per task, and write the reason in the table for every row, including
the low ones. "Low" alone tells the user nothing about why Sonnet is safe
there; "low: copies the existing tab pattern, fixture diff catches drift"
does. The rule that has held up:

- **Opus** where a mistake is silent or expensive: data loss or leakage,
  deletion, ownership and access checks, migrations and their generators,
  watermarks and sync windows, security gates, the correctness core of the
  feature, and anything that needs design judgment beyond the spec.
- **Sonnet** where the spec is mechanical and the tests catch errors: a
  well-specified module with a clear interface, UI that mirrors a prototype,
  generators with a fixture to diff against, docs, glossary, README, config
  polish.

If the user said "all opus" or "sonnet agents", use that and skip the
per-task choice, but keep the complexity column so they can still see where
risk sits.

### Surface what the plan left open

Read the plan for gaps a worker would hit and could not settle alone: a view
body written as `...`, an unnamed source for a value, an unspecified retry
schedule, a wire format the plan never wrote down, two decisions that
contradict each other. List each one with the answer you propose, so the
user can approve or change it in the same reply as the split. Decisions
settled here go into the prompts as fact; a gap discovered by a worker costs
a blocked envelope and a round trip.

Do not invent facts about external systems (what a collector returns, how a
service deduplicates) and present them as known. Mark them as assumptions
the worker must verify, or ask the user. And never quietly override a
decision the plan marks final. If a final decision looks wrong or
inconsistent, say so in this block and let the user rule.

### Present the split

Use this shape. Keep every cell short; the prompt files hold the detail.

```markdown
Here is the split. <N> workers in <M> waves, <one-sentence model rule>.

**Wave 0, coordinator (me)** — only if there is a shared-surface task

| Task | Scope | Why me |

**Wave 1, <n> workers in parallel, disjoint files**

| Task | Owns | Delivers | Complexity | Model |

**Wave 2, after their dependencies merge**

| Task | Owns | Delivers | Depends on | Complexity | Model |

**Mechanics**
- Branch per worker off <base>, named <pattern>, workspaces via superset.
- File ownership per wave in one line each, proving no overlap.
- What the coordinator does at merge time and which checks it runs itself.
- Deploys: none between waves, or the exact list and order.
- Rules that go into every prompt (the two or three invariants of this milestone).

**Open decisions** — numbered, each with the proposed answer and the task it goes into.

Rough wall time per wave, and the model-hour total.

Anything you want moved between models or merged into fewer workers? If not, I start wave <0|1> now.
```

Task IDs are stable short labels (`T1`, `C1b`, `PR3`) that every later status
table, prompt, and envelope reuses. The rules line is where the milestone's
invariants live ("only the `turn_origins` view counts human turns",
"nothing under `src/classify` imports from `src/ui`"). Workers cannot infer
these from the code, and one worker breaking one costs a full review round.

Then stop and wait. Apply whatever the user changes and re-present only the
rows that moved.

## Phase 2: dispatch and coordinate

Load `superset:orchestrate` and follow it for the transport: control surface,
workspaces, terminals, envelopes, monitoring. This section covers what that
skill leaves to the coordinator.

### Write the prompts before launching

Write one shared file and one file per task into the scratchpad, then launch
from those files. A prompt on disk can be re-read after context loss, reused
for a redispatch, and diffed when a worker misreads it.

**Shared file** (`common.md`), read first by every worker:

- Role: one worker in a coordinated build, own worktree, own branch, never
  switch branches or touch other worktrees, commit when done, push only if
  the user's workflow includes it.
- What to read first: the plan section by path and heading, the domain
  glossary, the README. State that the decisions there are final.
- Repo conventions the worker cannot guess: toolchain, test command that
  must pass before commit, dependency policy, code style rules the user
  enforces (no comments, dependency injection, named-parameter upserts, plain
  B2 English in prose), commit message format including the attribution line.
- The milestone rules from the split table.
- Live resources and their safety rules: real databases read-only, which
  services may be called for a smoke test, what must never run from a
  worktree.
- The `SUPERSET_WORKER_DONE` and `SUPERSET_WORKER_BLOCKED` envelopes from
  the orchestrate skill, with a `checks` line that includes the test count.

**Task file** (`<id>.md`) per worker:

- Read order: `common.md`, then the exact files that show the pattern to
  follow (an existing migration, the test that starts a fake server, the one
  `fetch` call in the repo).
- Whether it depends on another task, and if it starts before that task
  merges, the local stand-in to use ("define the type locally; T1 produces
  the same shape").
- **Deliver**: a numbered list of concrete artifacts with exact paths, exact
  names, exact semantics. Spell out edge cases the plan decided (tie
  handling, null versus empty, fail-closed on flag absence).
- **Verify**: the commands to run, what numbers to expect, and what to
  report in the envelope. The repo check alone is not enough; it passes
  while a milestone rule is broken. Add one command per rule this task could
  break (a grep for the forbidden import, a grep for the aggregation outside
  the view), a scope check that diffs the branch against its base and
  compares the file list with Owns, and any live or scratch-copy run the task
  needs. Scratch copies go under a temp path and get removed.

Precision here is what lets Sonnet take the mechanical tasks. A vague prompt
turns a Sonnet task into an Opus task with extra rounds.

Keep the prompt faithful to what the user approved: the same task IDs, the
same owned paths, the same model. If a prompt needs a path the split did not
list (a shared types file, a test helper), add it to the coordinator table
and say so in the launch message. A launched prompt has no placeholders left
in it; fill handoff data in before launch or send it with `terminals send`
after. Read `common.md` and every task prompt together once before launch:
a ruling that creates an exception to a shared rule (a batch that may move
the watermark on a 400) goes into the shared rule itself, or the worker meets
two rules that contradict each other and blocks.

Write wave 2 and 3 prompts while wave 1 runs, so they launch the minute a
dependency merges. Add the merged dependency's real shapes (route paths,
package pins, exported names) to those prompts before launch.

### Launch with the chosen model

Create one workspace per worker on its own branch from the right base, then
launch the agent with the model from the split table:

```bash
superset workspaces create --local --project <id> --name <task-name> \
  --branch <branch> --base-branch <base> --skip-branch-prefix --json
superset agents create --workspace <workspace-id> --agent claude \
  --model <opus|sonnet> --prompt "$(cat <scratchpad>/prompts/<id>.md)" --json
```

Check `superset agents create --help` once per session; flag names have
changed before. When the user gave a naming pattern for the sessions or
branches, use it verbatim. Keep the coordinator table from the orchestrate
skill with an extra `Model` column, and launch only the tasks whose
dependencies are already merged.

### Coordinate as the architect

- **Rule, do not code.** Workers will send design questions and conflicts
  between two rules in their prompt. Answer with a decision and the reason,
  record the ruling in the plan doc, and tell the worker to proceed. A ruling
  stays inside the plan's final decisions; when a worker's question shows a
  final decision cannot work, take it to the user. If the ruling changes a
  document the user owns, tell the user instead of letting the worker edit
  it.
- **Verify before ticking.** A `DONE` envelope is a claim. Read the diff,
  run the check command yourself, and compare the numbers in the envelope
  with what you see. Only then mark the task done and update the checklist or
  progress page. Nobody else marks items done.
- **Merge in dependency order.** Merge or approve a task only after its own
  dependencies are merged. Do the coordinator wiring at merge time. Rebase
  dependent branches when a base moves and ask the worker to confirm no
  conflict markers remain.
- **Launch the next wave per task**, not per wave: as soon as a task's
  dependencies are all merged, launch it with the real handoff data.
- **Watch, then report in tables.** Arm a watcher on running terminals and
  re-arm it after each wake. Report status as a table with `Task`, `Model`,
  `Branch`, `State`, and one line for what the user must do (a merge, a
  permission, an approval gate). Do not narrate polling.
- **Stop on a blocker that needs the user.** A machine permission, a review
  gate, a missing secret, a decision the plan did not make: say exactly what
  the user must do, keep the unaffected workers running, and tell the blocked
  worker how to finish without the blocked part if possible.

### Finish

When every task is merged or its PR is open and green, give one closing
table: task, model, branch or PR link, checks you ran yourself, and what
remains for the user in order. Distinguish worker claims from your own
verification. Save the stack state where the next session will find it (the
plan file, memory, or a handoff doc) so a fresh coordinator can pick it up.

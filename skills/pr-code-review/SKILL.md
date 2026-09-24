---
name: pr-code-review
description: >-
  Review a PR, a PR stack, or the working branch (uncommitted files and unpushed
  commits) before a human reviews it. Runs the code-review skill with a focus the
  user states (usually "does not break anything" plus a business-logic question),
  validates every finding against the code with evidence, drops nits, and reports
  one table sorted by severity in simple English with a final verdict. Invoked as
  /pr-code-review.
argument-hint: "[pr-url | pr-number | stack | branch | last N commits | ref] [what to verify]"
disable-model-invocation: true
---

# PR code review

The user runs this before they ask a person to review. The output must be short,
proven, and easy to act on. Read-only: never post to the PR, never push, never
fix code here. When the user later says "fix it" or "post it", that is a new task.

## 1. Parse the arguments

The argument has two parts, in any order:

- **Target** — what to review. One of:
  - A PR URL or number (`https://github.com/<owner>/<repo>/pull/<n>` or `#n`).
  - A stack: "the stack", "entire stack", "should be N PRs", or "starting from
    <pr>". Walk the stack (step 2) and review every PR in it.
  - The working branch: "this branch", "my changes", "the last N commits", "the
    fixes", "the latest changes", "this change", or a git ref. This mode covers
    uncommitted files and unpushed commits too. With no target at all, use this
    mode.
- **Focus** — what the user wants proven. Examples from past runs:
  - "make sure it is not breaking anything" (present in almost every run — treat
    it as always on, even when not written)
  - "make sure business logic matches the PR body"
  - "make sure it was strictly a refactor and no logic was affected"
  - "make sure it follows react best practices"
  - "make sure we don't risk deleting the wrong tenant"
  - "see that it plays nicely with PRs #1490 + #1491"
  - "check why we have failing checks"

Write the focus down as a short list of yes/no questions. The final verdict must
answer each one.

Default rules, always in force unless the user says otherwise:

- **No nitpicking.** Style, naming, comment wording, duplicated test helpers,
  "could be extracted", and anything a linter or formatter already enforces are
  out. The user has said "do not nit pick" in most runs; do not wait to be told.
  A test is not a nit when it does not exercise what its name or the PR body
  claims. The user reads tests as proof that the change works, so a test that
  passes for the wrong reason is a real finding (usually Medium). A wish for
  more coverage is still a nit.
- **Evidence for every finding.** A finding with no proof is not reported.
- **Plain English** (CEFR B2). Short sentences. No jargon the PR author would not
  use.

## 2. Resolve the target to a fixed point

Never review from the PR page alone. Fetch the code.

**PR:**

```
gh pr view <n> --json title,body,url,state,isDraft,baseRefName,headRefName,headRefOid,commits,files,statusCheckRollup
git fetch origin <baseRefName> <headRefName>
```

When the URL points at a repo other than the current one (past runs reviewed an
`accomplish-ci` PR from the `accomplish-tenant-platform` checkout), look for a
local clone first (`~/GIT/<repo>`, `~/projects/<repo>`), and otherwise clone into
the session scratchpad directory with `gh repo clone <owner>/<repo>`. Pass
`--repo <owner>/<repo>` to every `gh` call in that case.

Fixed point is `origin/<baseRefName>`, head is `origin/<headRefName>`. Use
`git diff origin/<base>...origin/<head>` (three-dot). When the checked-out branch
is not the PR branch, or the working tree has local changes that are not part of
the PR, add a detached worktree in the session scratchpad directory so you can
grep and run tests without touching the user's tree:

```
git worktree add --detach <scratchpad>/pr<n> origin/<headRefName>
```

Remove it at the end with `git worktree remove --force <path>`.

**Stack:** a PR is stacked when its base is not the default branch, or another
open PR uses its head as a base:

```
gh pr list --state open --json number,title,url,headRefName,baseRefName,isDraft
```

Follow the links both ways. When the user said how many PRs to expect ("should be
5 PRs") and you found a different number, say so before reviewing; a missing PR
usually means a wrong base branch. Review in order, bottom first, each PR against
its own base. Also review the whole stack as one diff (bottom base to top head) because
some bugs live between PRs: a field added in PR 2 that PR 4 forgets to pass, a
migration in PR 1 that PR 3 assumes ran. Say which PR each finding belongs to.

**Working branch:** the review covers three layers. Find out which ones exist:

```
git status --porcelain
git rev-parse --abbrev-ref @{upstream} 2>/dev/null && git log --oneline @{upstream}..HEAD
DEFAULT=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's#origin/##')
git merge-base origin/$DEFAULT HEAD
```

When `origin/HEAD` is not set, take the default branch from
`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`.

- Uncommitted changes (staged, unstaged, and untracked files). Always included
  when present. Review them from the working tree, not from a commit.
- Unpushed commits: `@{upstream}..HEAD`. When the branch has no upstream, every
  commit since the merge-base is unpushed.
- The rest of the branch since the merge-base with the default branch.

Pick the fixed point from the user's words:

- No target, "this branch", "my changes": fixed point is the merge-base with the
  default branch, so the review sees the whole branch plus the working tree.
- "The last N commits": fixed point is `HEAD~N`, plus the working tree.
- "The fixes" or "latest changes": the commits since the last review in this
  session, or `@{upstream}` when there was no earlier review, plus the working
  tree.
- A git ref: that ref, plus the working tree.

The diff is `git diff <fixed-point>` (two-dot against the working tree, not
`HEAD`) so uncommitted changes are in it. `git diff` does not show untracked
files. List them with `git ls-files --others --exclude-standard` and diff each
one with `git diff --no-index /dev/null <file>`. Do not use `git add -N` to make
them appear; it changes the user's index. Say in the report which layers were reviewed and how many
uncommitted files and unpushed commits there were.

When the branch already has an open PR, read its body and CI as in the PR mode,
but still review the working tree, which is newer than what the PR shows.

Confirm the fixed point with `git rev-parse` and check the diff is not empty
before spawning anything.

**CI:** for a PR, read `statusCheckRollup`. A failing check is always a finding.
When the user asked why checks fail, open the failing run's log
(`gh run view <id> --log-failed`) and put the root cause in the table.

## 3. Run the code-review skill

Invoke the `code-review` skill with the fixed point from step 2. It runs a
Standards sub-agent and a Spec sub-agent in parallel. Two of its steps need care:

- It diffs `<fixed-point>...HEAD`. That is wrong for a PR reviewed from another
  branch and drops uncommitted changes in branch mode. Give the sub-agents the
  exact diff command from step 2 (`origin/<base>...origin/<head>` for a PR,
  `git diff <fixed-point>` plus the untracked files for a branch) instead of
  letting them derive it from `HEAD`.
- It looks for `docs/agents/issue-tracker.md` and asks to run a setup skill when
  it is missing. Do not stop for that. Fetch the Jira ticket with the Atlassian
  tools directly and pass its contents in.

Feed it:

- The fixed point and head, exactly as resolved above.
- The spec source: the PR body, the linked Jira ticket (fetch it when the branch
  or PR names an `ENG-` key), and the user's focus questions. When there is no
  ticket and no PR body, the focus questions are the spec.
- The instruction that the Standards axis must skip smell-baseline judgement
  calls unless they hide a real bug. The user wants to know what is broken, not
  what could be refactored.

Add a third pass yourself, in the main context, for the **breakage axis**. The
sub-agents look at the diff; you look at what the diff touches:

- For every changed export, signature, schema, event, migration, config key, or
  workflow step: grep for all callers and readers on the head tree. Anything that
  still uses the old shape is a finding.
- For a refactor: diff the behaviour, not the text. Same inputs must give the
  same outputs, same side effects, same error paths.
- For a bug fix: check the fix does not open a different bug ("make sure this fix
  is not creating a different bug").
- For an e2e or test change: confirm the test still fails when the feature is
  broken. A test that passes on both sides tests nothing.
- Run the unit tests that cover the changed files when they exist and run in under
  a few minutes. Report the count.

## 4. Validate every finding before it goes in the table

This is the step the user asks for by hand every time. Do it without being asked.

For each candidate finding from the sub-agents or your own pass:

1. **Open the code at head.** Quote the lines. Sub-agents work from the diff and
   miss guards that sit outside the hunk. Past runs reported a High that a
   `Math.min(..., 99)` two lines above made impossible, and "edge cases" that were
   not bugs. Both were dropped after the user pushed back. Drop them yourself.
2. **Trace the path.** Show the exact input or sequence that triggers the issue:
   which caller, which value, which order of events. If you cannot write that
   sequence, the finding is not proven. Drop it or run it.
3. **Prefer running to reading.** When a repro is cheap (a unit test, a script, a
   query against the local DB, a call to the dev environment), run it and use the
   output as the evidence.
4. **Check the PR body against the diff.** A body that claims a change the diff
   does not contain is a finding. Reviewers read the body first.
5. **Rate the real impact**, not the code smell. Ask: what breaks for a user or an
   operator, and how often? That decides the severity.

Findings that survive go in the table. Findings that do not survive go in a
short "Checked and dropped" list under the table, one line each with the reason.
The user needs that list to trust a short table: a review that reports one
finding and says nothing about what else was considered reads as a shallow
review, even when it was not. A dropped line is also where the user can disagree
and ask you to promote it.

## 5. Report

Above the table, two lines: the fixed point and head (short SHAs, commit count,
and for the working branch the number of uncommitted files and unpushed commits),
and the spec source used. Nothing else before the table.

One combined table, sorted Critical first. Never split it by axis (Standards
vs Spec) or by PR; the user wants every finding in one place, ranked. For a stack,
add a `PR` column as the first column, and write "between PRs" in it for a
finding that only shows when the PRs are combined.

| Severity | Location | Issue | Evidence | Suggested fix |
|---|---|---|---|---|

- **Severity**: `Critical`, `High`, `Medium`, `Low`. When the user asks for
  P1/P2/P3, map Critical and High to P1, Medium to P2, Low to P3, and say so once
  under the table. P1 is the most severe.
- **Location**: `path:line` on the head commit, or on the working tree in
  branch mode. One cell, one place. When a finding
  spans files, name the one where the fix goes.
- **Issue**: one or two sentences. What is wrong and what breaks because of it.
  Written for the PR author, in plain English.
- **Evidence**: the quoted line, the repro sequence, the test output, or the
  caller that still uses the old shape. Short. A reader must be able to check it
  in under a minute.
- **Suggested fix**: the most direct change. One sentence when possible.

Under the table, in this order and nothing more:

- **Verified clean**: one line listing what you checked and found fine (callers
  grepped, tests run with count, CI state, migrations, config readers). The user
  needs to know what "no findings" covers.
- **Checked and dropped**: the candidates from step 4 that did not survive, one
  line each: what it was and why it is not a finding ("timing assert has 425 ms
  margin over 5 runs", "pre-existing on master, not in the diff"). Leave out
  candidates that were pure style.
- **Verdict**: one line per focus question with a yes or no and a short reason,
  then one bold line: safe to merge, or not, and which findings block it. A
  Critical or High blocks. Medium and Low do not, unless the user's focus question
  is answered "no".

When there are no findings, keep the table header with a single row that says
"None", and still write the Verified clean line and the Verdict. The user trusts
an empty table only when they can see what was checked.

## 6. Follow-ups the user often asks for next

Keep the findings and evidence in context so these take one step:

- "fix the issues" — fix them in the working tree and leave them unstaged unless
  told to commit.
- "post the should-fix comments on the PR" — post one review comment per
  finding at its location, in the same plain English, and nothing for Low unless
  asked.
- "explain finding N" or "how can it happen?" — show the full trace from step 4.
  If you cannot, withdraw the finding and say so plainly.
- "show it in a table" — the table is already the format; re-show it unchanged.

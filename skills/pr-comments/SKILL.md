---
name: pr-comments
description: >-
  Read the open review comments on a pull request and show them in one table
  sorted by severity, with location, issue, and suggested fix, in simple English.
  Invoked as /pr-comments; defaults to the PR of the current branch.
argument-hint: "[pr-number-or-url]"
disable-model-invocation: true
---

# PR comments as a table

Read-only. Never reply to, resolve, or edit a comment here.

## 1. Resolve the PR

Use the PR from the argument when one was given. With no argument, use the PR of
the branch that is checked out right now — `gh pr view` with no PR argument does
exactly that:

```
gh pr view --json number,url
```

Do not ask the user which PR; the current branch is the answer.

Take `<owner>`, `<repo>`, and `<number>` from the URL
(`https://github.com/<owner>/<repo>/pull/<number>`). Do not use the head
repository fields — on a fork PR they point at the fork, and the comments live on
the base repo.

If no PR exists, stop and tell the user.

## 2. Fetch every kind of comment

A PR has three comment sources. Fetch all three or you will miss feedback:

**Inline review threads** — with resolved state, which the REST API does not give:

```
gh api graphql -f query='
query($owner:String!,$repo:String!,$n:Int!){
  repository(owner:$owner,name:$repo){ pullRequest(number:$n){
    reviewThreads(first:100){ nodes{
      isResolved isOutdated path line
      comments(first:20){ nodes{ author{login} body url } }
    }}
  }}
}' -F owner=<owner> -F repo=<repo> -F n=<number>
```

**Review summaries** (the body a reviewer writes with Approve / Request changes):

```
gh api repos/<owner>/<repo>/pulls/<number>/reviews --paginate
```

**Conversation comments** (the PR's main thread, where bots post overviews):

```
gh api repos/<owner>/<repo>/issues/<number>/comments --paginate
```

## 3. Keep only what still needs action

- Drop resolved threads. Say how many you dropped.
- Drop empty review bodies and pure approvals ("LGTM").
- Keep outdated threads, but mark them — the code moved, the point may still stand.
- A bot overview comment often repeats the inline findings. Do not list the same
  point twice; keep the inline one, which has a location.

## 4. Assign a severity

Use one scale: **Critical**, **High**, **Medium**, **Low**, **Nit**.

- When the comment states a severity (CodeRabbit, Codex, and similar bots label
  findings: "critical", "major", "minor", "nitpick", "potential issue", "refactor
  suggestion"), map it to the scale.
- When it does not, infer from content: a bug or security issue is High or above,
  a missing test or unclear logic is Medium, style is Low, wording is Nit. Mark
  inferred severities with `*` and explain the mark once under the table.

## 5. Show the table

One table, sorted Critical first. Columns:

| Severity | Location | Issue | Suggested fix |
|---|---|---|---|

- **Location**: `path:line`, linked to the comment URL. Review summaries and
  conversation comments have no file; write "PR" there.
- **Issue**: one or two short sentences in simple English (CEFR B2). Say what is
  wrong and why it matters. Do not copy the comment; restate it.
- **Suggested fix**: what the reviewer proposed. When the reviewer gave none, write
  the most direct fix yourself and mark it `(mine)`.

Above the table, one line: how many open comments, how many resolved were skipped,
and whether any thread is outdated. Nothing else — no preamble, no closing summary.

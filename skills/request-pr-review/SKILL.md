---
name: request-pr-review
description: >-
  Add a pull request to the team's "PR Pending review" Slack list, always after
  the user approves a preview of the exact row. Use when the user asks to "request
  a review", "add this PR to the review list", or wants a PR queued for review.
argument-hint: "[pr-number-or-url] [single|stack]"
disable-model-invocation: true
---

# Request a PR review

Reviews are requested by adding a row to the Slack list **PR Pending review**
(`list_id: F0C2AQ7PG4C`, https://accomplish-ai.slack.com/lists/T09TKPM7BCM/F0C2AQ7PG4C).
Do not post to a channel unless the user asks for one instead.

Arguments, in any order, all optional:

- A PR number or URL. Default is the PR of the current branch.
- Words like "just this PR", "single", or "no stack" — add a row for this PR
  alone, even when it belongs to a stack.

Never write to the list before the user approves the preview. This rule holds even
if the user said "just post it" earlier in the session.

## 1. Resolve the PR

Use the PR from the argument when one was given. Otherwise use the PR of the
branch that is checked out right now:

```
gh pr view --json number,title,url,body,isDraft,headRefName,baseRefName
```

If no PR exists, stop and tell the user. Do not create one.

Then look for a **stack**. A PR is stacked when its `baseRefName` is not the repo
default branch, or when another open PR uses its `headRefName` as a base:

```
gh pr list --state open --json number,title,url,headRefName,baseRefName,isDraft
```

Follow base links down to the PR that targets the default branch, and head links up
to the last PR nothing else builds on. That chain is the stack, in review order —
bottom first.

**A stack is never assumed.** When the chain holds more than the resolved PR, and
the user did not already say which they want, ask before drafting: the stack (one
row for its base PR), or this PR alone?

## 2. Read the list schema, then check for duplicates

Call `slack_read_list` with `list_id: F0C2AQ7PG4C` and `schema_only: true` to get
the current columns and the allowed `select` options — do not trust the copy
below if they differ. Then read the records and stop if a row with the same PR URL
already exists; report its status instead of adding a second row.

Columns as of this writing:

| Column | Type | Value to write |
|---|---|---|
| Summary | text | The PR title, verbatim. Existing rows use the conventional-commit title with the ticket id, e.g. `feat(audit-v2): ENG-3827 tenant-scoped batch upload grant contract`. |
| Repo | select | Map from the GitHub repo name by dropping the `accomplish-` prefix: `accomplish-tenant-platform` → `tenant-platform`, `accomplish-agent-runtime` → `agent-runtime`, `accomplish-contracts` → `contracts`, `accomplish-sandbox` → `sandbox`, `accomplish-desktop` → `desktop`, `accomplish-e2e` → `E2E`. If the repo is not an option, ask the user. |
| Url | link | The PR URL. |
| Author | user | The Slack user ID of the person running this skill. Resolve it once with `slack_search_users` from the git author name or email; the preview shows it so a wrong match is caught before writing. |
| Status | select | `Pending review`. |
| Reviewer | user | Empty, unless the user named a reviewer — then their Slack user ID. |

A draft PR does not go on the list. Say so and stop, unless the user insists.

## 3. Draft the row

Always one row. A stack gets **one row for its base PR** — the PR that targets the
default branch — never a row per PR; the list is a queue, not a changelog. Say it
is a stack in the Summary: the base PR's title, then ` (stack of N PRs)`. The
reviewer starts at the base and follows the chain from there.

## 4. Preview and approve

The preview must live **inside** the question. Prose printed before an
`AskUserQuestion` call is not shown to the user — they see only the dialog. Put the
full row (every column and value) in the `preview` field of the "Add it" option,
and name the list in the `question` string.

Options:

- **Add it** — description: adds the row to PR Pending review exactly as
  previewed.
- **Edit first** — description: "type the change as Other, e.g. 'reviewer: Dana'".
  Word it so the user can give the edit in one step; a bare "Edit first" that makes
  you ask "what should change?" costs an extra round for nothing.
- **Cancel** — write nothing.

Redraft and preview again after an edit. Loop until the user approves or cancels.

## 5. Add the row in two writes

Only after approval. The write is split in two on purpose: the automation that
picks up new rows listens to **list item updated** — Slack has no "item added"
trigger — so a row created with every field filled in is never seen. The Url is
what the automation acts on, so it must arrive in a second call.

1. `slack_add_list_record` with `list_id: F0C2AQ7PG4C` and every column from the
   preview **except Url**. Keep the `record_id` it returns.
2. `slack_update_list_record` with the same `list_id`, that `record_id`, and
   `updated_columns` holding **only Url**.

Never merge the two calls, and never put Url in the first one, even when it looks
redundant. If the first call fails, nothing was written; fix and retry from step 1.
If the second call fails, the row exists without a Url: retry the update with the
same `record_id` — do not create another row. Report the record link.

If a call fails on a column name or option, re-read the schema, fix the value, and
preview again — do not guess a second time.

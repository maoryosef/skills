---
name: request-pr-review
description: >-
  Post a Slack message that asks teammates to review a pull request, always after
  the user approves a preview of the exact text. Use when the user asks to "ask for
  a review in Slack", "post this PR to #channel", or wants a review request shared
  with a team channel.
disable-model-invocation: true
---

# Request a PR review in Slack

Arguments, in any order:

- The target Slack channel. When the user gave none, ask — never guess a channel.
- Optional: a PR number or URL. Default is the PR of the current branch.
- Optional: words like "just this PR", "single", or "no stack". They mean post about
  one PR even when it belongs to a stack.

Never post before the user approves the preview. This rule holds even if the user
said "just post it" earlier in the session.

## 1. Resolve the PR

Use the PR the user named. Otherwise take the PR of the current branch:

```
gh pr view --json number,title,url,body,author,isDraft,additions,deletions,changedFiles,reviewRequests,headRefName,baseRefName
```

If no PR exists for the branch, stop and tell the user. Do not create one.
If more than one PR matches, ask the user which one.

Then look for a **stack**. A PR is stacked when its `baseRefName` is not the repo
default branch, or when another open PR uses its `headRefName` as a base:

```
gh pr list --state open --json number,title,url,body,headRefName,baseRefName,isDraft
```

Follow base links down to the PR that targets the default branch, and head links up
to the last PR nothing else builds on. That chain is the stack, in review order —
bottom first.

**A stack is never assumed.** When the chain holds more than the resolved PR, and
the user did not already say which they want, ask before drafting: this PR only, or
the whole stack? Posting three teammates' worth of review requests when one was
wanted is the expensive mistake here.

## 2. Resolve the channel

Strip a leading `#`. Confirm the channel exists with `slack_search_channels`. If the
name matches nothing, or matches several channels, ask the user to pick.

## 3. Read the channel before you draft

Read the last few posts with `slack_read_channel` (limit 10) and **mirror their
shape**. Teams settle on a house style, and a message that ignores it reads as
noise. Look at length, capitalization, whether anyone states an explicit ask, and
whether links are bare or titled.

The channel also tells you what to leave out. In a dedicated review-request channel
(`#pr-reviews-*` and the like) the channel *is* the ask, so drop "review please"
and drop size hints — everyone there is already looking for PRs to review.

If the channel read fails or the channel is empty, use the default below.

## 4. Draft the message

Short by default. A reviewer decides from the first line whether to open the PR.

**Single PR — the default shape:**

```
one lowercase sentence with the ticket id saying what the PR does
https://github.com/org/repo/pull/1460
```

Two lines: a plain sentence, then the bare PR URL on its own line. Send it with
`unfurl_app_links: true` so Slack renders the GitHub preview card — that card
carries the title, size, and status, which is why the message itself does not.

Take the sentence from the PR body, not from a guess. If the body is empty, say so
in the preview and ask the user for the summary. Say a PR is a draft when
`isDraft` is true.

Only go richer than two lines when the channel's recent posts are richer.

**A stack — one message for the whole chain, never one per PR:**

```
**ENG-3439: group-scoped Network sandbox policies**, resolved per user in the bridge, behind LD flag `admin-sandbox-group-network-policies` (off). Tested end to end in dev-1. Review in order, each PR is based on the previous one:

1. [#1460](https://github.com/org/repo/pull/1460) bridge + storage: group policy table, bridge actions, per-user resolution
2. [#1461](https://github.com/org/repo/pull/1461) gateway + portal server: per-user sandbox config route, flag-gated CRUD routes
3. [#1465](https://github.com/org/repo/pull/1465) portal client: Network Controls on GroupAccess with per-group Monitor mode

Design: https://link/to/design
```

The parts, in order:

- **A bold header line** naming the ticket and the goal of the whole stack, then the
  facts a reviewer needs before opening anything: where the behavior resolves, the
  feature flag and its state, and how it was tested. Take these from the PR bodies.
  Ask the user for the flag or the test status when no PR body states it — never
  invent either. The message claims the stack was verified; that claim must be true.
- **The review instruction**: the order matters, each PR builds on the one above.
- **A numbered list, bottom of the stack first.** One line per PR: the link with
  `#<number>` as its text, the area it touches, then a short summary. One line each.
- **A trailing `Design:` line** only when a design doc or spec exists.

Mark a draft PR inline on its own line. Skip per-PR size hints — they stop the list
being scannable.

**Formatting.** `slack_send_message` takes **standard markdown**, not Slack mrkdwn:
`**bold**`, `` `code` ``, `[text](url)`. Do not write `<url|text>` or single-asterisk
bold; Slack converts on send. Leave a URL bare when you want it to unfurl. Do not
@-mention anyone unless the user asked for it.

## 5. Preview and approve

The preview must live **inside** the question. Prose printed before an
`AskUserQuestion` call is not shown to the user — they see only the dialog. Put the
full message text in the `preview` field of the "Post it" option (single-select
renders it side by side), and name the target channel in the `question` string.

Options:

- **Post it** — description: sends to `#channel` exactly as previewed.
- **Edit first** — description: "type the change as Other, e.g. 'shorter, one line'".
  Word it so the user can give the edit in one step; a bare "Edit first" that makes
  you ask "what should change?" costs an extra round for nothing.
- **Cancel** — post nothing.

Redraft and preview again after an edit. Loop until the user approves or cancels.

## 6. Post

Only after approval, send with `slack_send_message` to the resolved channel, with
`unfurl_app_links: true`. Report the permalink of the posted message.

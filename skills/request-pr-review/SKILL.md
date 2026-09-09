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

Arguments: the first is the target Slack channel, the second (optional) is the PR
number or URL. When the user gave no channel, ask for one — never guess a channel.

Never post before the user approves the preview. This rule holds even if the user
said "just post it" earlier in the session.

## 1. Resolve the PR

Use the PR from the second argument if given. Otherwise take the PR of the current
branch:

```
gh pr view --json number,title,url,body,author,isDraft,additions,deletions,changedFiles,reviewRequests,headRefName,baseRefName
```

If no PR exists for the branch, stop and tell the user. Do not create one.
If more than one PR matches, ask the user which one.

Then check whether the PR sits in a **stack**. A PR is stacked when its
`baseRefName` is not the repo default branch, or when another open PR uses its
`headRefName` as a base. Walk both directions to get the whole chain:

```
gh pr list --state open --json number,title,url,body,headRefName,baseRefName,isDraft
```

Follow base links down to the PR that targets the default branch, and head links up
to the last PR nothing else builds on. The result is the stack in review order —
bottom first. Include every PR in the chain, not only the ones the user named.

## 2. Resolve the channel

The first argument names the channel. Strip a leading `#`. Confirm it exists with
`slack_search_channels`. If the name matches nothing, or matches several channels,
ask the user to pick before you continue.

## 3. Draft the message

Keep it short — a reviewer must understand the ask in a few seconds. For a single
PR:

- One line with the PR title as a link to the PR URL.
- One or two lines on what the change does and why. Take this from the PR body, not
  from a guess. If the body is empty, say so in the preview and ask the user for the
  summary.
- A size hint: files changed, plus additions and deletions.
- The explicit ask: who should review, or a plain "review please" when nobody is
  named.
- Mark the PR as a draft when `isDraft` is true.

Write plain Slack text. Use `<url|title>` for the link. Do not @-mention anyone
unless the user asked for it.

### When the PR is part of a stack

Post one message for the whole stack, never one per PR. Shape it like this:

```
*ENG-3439: group-scoped Network sandbox policies*, resolved per user in the bridge,
behind LD flag `admin-sandbox-group-network-policies` (off). Tested end to end in
dev-1. Review in order, each PR is based on the previous one:

1. <https://github.com/org/repo/pull/1460|#1460> bridge + storage: group policy table, bridge actions, per-user resolution
2. <https://github.com/org/repo/pull/1461|#1461> gateway + portal server: per-user sandbox config route, flag-gated CRUD routes
3. <https://github.com/org/repo/pull/1465|#1465> portal client: Network Controls on GroupAccess with per-group Monitor mode
Design: <https://link/to/design|link/to/design>
```

The parts, in order:

- **A bold header line** naming the ticket and the goal of the whole stack, then the
  facts a reviewer needs before opening anything: where the behavior resolves, the
  feature flag and its state, and how it was tested. Take these from the PR bodies.
  Ask the user for the flag or the test status when no PR body states it — never
  invent either.
- **The review instruction**: say the order matters and that each PR builds on the
  one above it.
- **A numbered list, bottom of the stack first.** One line per PR: the link with
  `#<number>` as the text, then the area it touches, then a short summary of what it
  does. Keep each line to one line. Summarize from the PR title and body.
- **A trailing `Design:` line** only when a design doc or spec exists.

Skip the per-PR size hints here — they would stop the list being scannable. Mark a
draft PR inline on its own line.

## 4. Preview and approve

Show the exact message text and the target channel to the user. Then use
`AskUserQuestion` with these options:

- **Post it** — send as previewed.
- **Edit first** — the user tells you what to change; redraft and preview again.
- **Cancel** — post nothing.

Loop on "Edit first" until the user approves or cancels.

## 5. Post

Only after approval, send with `slack_send_message` to the resolved channel. Report
the permalink of the posted message.

# Installed agent skills

Inventory of every skill installed on this machine, from all sources. The skills this repo owns are under `skills/`.

Skills live in `~/.agents/skills/` and are symlinked into `~/.claude/skills/`.
Most were installed with the [skills CLI](https://github.com/vercel-labs/skills) (`npx skills add <owner>/<repo> --skill <name>`), which records them in `~/.agents/.skill-lock.json`.
Skills not in the lockfile were installed by hand or by an app, noted below.

## accomplish-ai/skills

Source: https://github.com/accomplish-ai/skills

| Skill | Description |
|---|---|
| ask-question | Thought partner mode for questions and research, no code changes. |
| babysit-pr | Watch PR CI until green, retry flakes, fix failures, squash-merge. |
| create-jira-ticket | Create a Jira ticket for the Accomplish project. |
| debug-accomplish | Route Accomplish debugging requests to the right tool or skill. |
| finalize-to-pr | Prepare finished work for a PR. |
| gh-pr-production-ready | Drive a PR to merge-ready: self-review, CI, review comments. |
| html-pr-review | Standalone HTML explanation/review of a PR. |
| request-pr-review | Mark a PR ready and add the `review-requested` label. |
| teach | Teach a skill or concept inside the workspace. |

## accomplish-ai/page-drop

Source: https://github.com/accomplish-ai/page-drop

| Skill | Description |
|---|---|
| accomplish-report | Accomplish-branded engineering report as HTML, shared on pagedrop. |
| pagedrop-find | Find and read pages teammates shared on pagedrop. |
| pagedrop-publish | Publish, update, or unpublish a page on pagedrop. |

## maoryosef/skills (own)

Source: https://github.com/maoryosef/skills (local clone: `~/projects/skills`). Not in the lockfile, copied by hand.

| Skill | Description |
|---|---|
| codebase-analyzer | Map a codebase's main flows and diagram each one. |
| pr-code-review | Read-only, evidence-based review of a PR, stack, or branch. |
| pr-comments | Show open PR review comments in one table sorted by severity. |
| review-loop | Adversarial reviewer/coder loop until every finding is fixed or escalated. |
| split-and-dispatch | Split a plan into parallel worker tasks and drive them via superset:orchestrate. |

## mattpocock/skills

Source: https://github.com/mattpocock/skills

| Skill | Description |
|---|---|
| ask-matt | Router: which skill or flow fits the situation. |
| code-review | Review changes since a fixed point on Standards and Spec axes. |
| codebase-design | Vocabulary for designing deep modules. |
| diagnosing-bugs | Diagnosis loop for hard bugs and performance regressions. |
| domain-modeling | Build a project's domain model and record decisions. |
| grill-me | Relentless interview to sharpen a plan or design. |
| grill-with-docs | Same as grill-me, also writes ADRs and glossary. |
| grilling | Stress-test a plan, decision, or idea. |
| handoff | Compact the conversation into a handoff document. |
| implement | Implement work from a spec or tickets. |
| improve-codebase-architecture | Find deepening opportunities, show as HTML, then grill. |
| prototype | Throwaway prototype to answer a design question. |
| research | Investigate a question against primary sources, save as Markdown. |
| resolving-merge-conflicts | Resolve an in-progress merge or rebase conflict. |
| setup-matt-pocock-skills | One-time repo setup for the engineering skills. |
| to-spec | Turn the conversation into a spec on the issue tracker. |
| to-tickets | Break a plan into tracer-bullet tickets. |
| triage | Move issues and PRs through triage roles. |
| wayfinder | Plan very large work as decision tickets. |
| writing-great-skills | Principles for writing predictable skills. |

## DietrichGebert/ponytail

Source: https://github.com/DietrichGebert/ponytail

| Skill | Description |
|---|---|
| ponytail | Force the laziest solution that works (YAGNI, stdlib first). |
| ponytail-audit | Whole-repo audit for over-engineering. |
| ponytail-debt | Harvest `ponytail:` comments into a debt ledger. |
| ponytail-gain | Scoreboard of ponytail's measured impact. |
| ponytail-help | Quick reference for ponytail modes and commands. |
| ponytail-review | Code review that only hunts over-engineering. |

## cursor/plugins

Source: https://github.com/cursor/plugins (path `pstack/skills/`)

| Skill | Description |
|---|---|
| tdd | Test-driven development when asked for a failing or regression test. |
| typescript-best-practices | TypeScript best practices for any .ts or .tsx file. |
| unslop | Cut AI tells from any writing. |

## Other GitHub sources

| Skill | Source | Description |
|---|---|---|
| find-skills | https://github.com/vercel-labs/skills | Discover and install agent skills. |
| show-me | https://github.com/humanlayer/skills (`plugins/show-me`) | Explain a topic visually with diagrams and HTML artifacts. |
| skill-creator | https://github.com/anthropics/skills | Create, edit, and evaluate skills. |

## Superset app

Source: installed automatically by the Superset desktop app (https://github.com/superset-sh/superset). Not in the lockfile. Reinstalled on each app start.

| Skill | Description |
|---|---|
| superset-10x | Audit of advanced Superset features not yet in use. |
| superset-automate | Turn a recurring chore into a Superset automation. |
| superset-browser | Drive web pages from an agent. |
| superset-computer | Operate native desktop apps and windows. |
| superset-contribute | Set up a contribution to the Superset repo. |
| superset-doctor | Diagnose and fix Superset problems. |
| superset-feedback | Send feedback or bug reports to the Superset team. |
| superset-integrations | Call tools from connected integrations via `superset mcp`. |
| superset-orchestrate | Coordinate parallel coding agents in separate workspaces. |
| superset-page | Build and publish an HTML page to Superset. |
| superset-plugins | Install Superset plugins and call their MCP tools. |
| superset-setup | Author `.superset/config.json` for a repo. |
| superset-standup | Digest of what Superset agents did while away. |

## Refresh this list

```sh
python3 -c '
import json,os
d=json.load(open(os.path.expanduser("~/.agents/.skill-lock.json")))["skills"]
for n,v in sorted(d.items()): print(f"{n:32} {v[\"source\"]}")
'
comm -23 <(command ls ~/.agents/skills) <(python3 -c 'import json,os;print("\n".join(sorted(json.load(open(os.path.expanduser("~/.agents/.skill-lock.json")))["skills"])))')
```

The first command prints every locked skill with its repo. The second prints skills with no lockfile entry.

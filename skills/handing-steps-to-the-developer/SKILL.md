---
name: handing-steps-to-the-developer
description: Use when you give the user commands or steps to run by hand, such as a bootstrap, an apply, an install or a step after a merge, or when the user asks how to test something themselves.
metadata:
  accomplish_note: "Skill updated by Accomplish on behalf of Maor Yosef on 2026-11-24"
---
For each step, say what it does in one plain sentence, when it runs (before or after the command that prompts them, or after which event, such as a deploy job turning green), where it runs (which environment, account, tenant or database, and with which values filled in), what to run, and what output means it worked.
List every prerequisite a fresh checkout lacks, such as a build output git does not track, before the command that needs it.
When the user asks how to test something themselves, give the whole path in one reply, in order: how to start what it runs on, how to sign in, how to do the action, and what result to look for at each step.

---
name: checking-a-claim-before-stating-it
description: Use when you are about to tell the developer that something is fixed, works or now shows, that an issue is still open or can be closed, that a step is blocked or cannot run yet, or that something they need does not exist.
metadata:
  accomplish_note: "Skill updated by Accomplish on behalf of Maor Yosef on 2026-11-24"
---
# Checking a claim before stating it

Before you say a step cannot run because a resource, account, login or profile is missing, check for it with a read-only command (for example list the configured CLI profiles or query the resource).
If the check shows it exists, run the step if it is read-only and allowed; otherwise say what you found and ask.
If you cannot check, say it is unverified and name the command that would confirm it.
Before you say something is fixed, works or now shows, check it the way the user will meet it: the version they run, the page as it renders without a click, the command they will type. If you did not check, say so. In the same reply, say what was checked by hand in the running app and what was proven by tests only, and for each check who ran it and saw its output: you, a helper agent, or nobody yet. When you started a run or a review, such as an agent review that a label starts, say whether you saw it actually run and finish, or that you have not checked yet.

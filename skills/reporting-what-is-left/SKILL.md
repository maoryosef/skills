---
name: reporting-what-is-left
description: Use when you end a turn that built, changed, committed, pushed or started something, give a status, or say that work is ready to run.
---
For each service or command you built, say whether it is running right now or the developer must start it, and give the exact command to start it.
In every update, even a one-line one, and before you end the turn, list everything still open: background jobs still running, uncommitted changes, commits not pushed, checks not yet done, a person's approval or review the work waits on, and follow-ups you promised, and say whether the developer must act.
Before you list a worker or background job as still running, read its output in that same turn; do not repeat an earlier status.
When a run or check is still going as you end the turn, either wait on it in that turn with one blocking call, such as `gh pr checks <number> --watch`, and give the state it reached, or say it is still running and that nothing is watching it. Never promise to watch it or report back later.
Do not say the work is done, ready or that nothing is left while any of these remain.
When you ask the developer to confirm a value or choice, say whether a record fixed it or you picked it yourself, and where you took it from.

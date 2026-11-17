---
name: zsh-shell-commands
description: Use when you run any shell command on this Mac, including one that prints a separator line or chains several commands.
---
The shell is zsh: a glob that matches nothing stops the whole command with "no matches found", so quote every pattern you pass to a tool (`--include='*.ts'`) and use `find` instead of `ls` on a glob that may match nothing.
This Mac has no `timeout` command. Do not prefix commands with `timeout N`; run them without it, or use the tool's own timeout option.
The shell is zsh. zsh reads a bare word that starts with `=`, such as `=====`, as a command path, and the call fails with `===== not found`.
For separators between chained outputs, quote them, as in `echo '====='`, or use dashes, as in `echo -------`.
Never give a shell function a short name such as `l`, `g` or `rd`: they are aliases in this zsh, and defining them fails with `parse error near `()'`. Use a longer unique name, such as `ch_lifecycle`.
Never run a command whose output is a credential from the Bash tool, for any reason, including timing it, such as `cloudflared access token`, `cloudflared access login` without `--quiet`, `gh auth token` or `aws sts get-session-token`. Redirecting its output does not protect it: in zsh, `2>&1 >/dev/null | grep` still sends standard output into the pipe.
To measure such a command, time it inside the program that already calls it, or time a harmless sibling such as `cloudflared --version`.
If a discard is truly needed for another kind of command, wrap it so only one redirection applies: `{ cmd >/dev/null; } 2>&1 | grep x`, or run it through `bash -c`.

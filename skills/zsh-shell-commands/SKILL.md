---
name: zsh-shell-commands
description: Use when you run any shell command on this Mac, including one that prints a separator line or chains several commands.
---
The shell is zsh: a glob that matches nothing stops the whole command with "no matches found", so quote every pattern you pass to a tool (`--include='*.ts'`) and use `find` instead of `ls` on a glob that may match nothing.
This Mac has no `timeout` program. Do not wrap a command in `timeout`; set the Bash tool's own timeout parameter instead.
The shell is zsh. zsh reads a bare word that starts with `=`, such as `=====`, as a command path, and the call fails with `===== not found`.
For separators between chained outputs, quote them, as in `echo '====='`, or use dashes, as in `echo -------`.
Never give a shell function a short name such as `l`, `g` or `rd`: they are aliases in this zsh, and defining them fails with `parse error near `()'`. Use a longer unique name, such as `ch_lifecycle`.

---
name: zsh-shell-commands
description: Use when you write any Bash tool command on this Mac, also as a helper agent, including echo separators or chained cat calls.
---
The shell is zsh: a glob that matches nothing stops the whole command with "no matches found", so quote every pattern you pass to a tool (`--include='*.ts'`) and use `find` instead of `ls` on a glob that may match nothing.
This Mac has no `timeout` command. Do not prefix commands with `timeout N`; run them without it, or use the tool's own timeout option.
The shell is zsh. zsh reads a bare word that starts with `=`, such as `=====`, as a command path, and the call fails with `===== not found`.
For separators between chained outputs, quote them, as in `echo '====='`, or use dashes, as in `echo -------`.
Never give a shell function a short name such as `l`, `g` or `rd`: they are aliases in this zsh, and defining them fails with `parse error near `()'`. Use a longer unique name, such as `ch_lifecycle`.

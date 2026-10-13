---
name: running-pnpm
description: Use when you run pnpm on this Mac.
---
pnpm is not on PATH under fnm here, and each shell call starts fresh.
Run it as `env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@<version> <args>`, with the version from the `packageManager` field of the project's package.json, or put the shim directory on PATH in the same command that calls pnpm.

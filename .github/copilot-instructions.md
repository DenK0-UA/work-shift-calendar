# Copilot Workspace Instructions

These rules are always-on for this repository.

## First-Turn AI Preflight (mandatory)

On every new chat session in this repo:

1. Before substantial work, read `.github/AGENTS.md`.
2. Read `.github/internal/project-context.md`.
3. Read the most relevant file from `.github/internal/` for the current task.
4. In your first progress update, state which internal files were read.

Substantial work includes any of these actions:

- git pull/fetch/rebase/tag/release operations
- code edits
- build, test, deploy, or release commands
- Android/Capacitor sync or patch commands

If preflight was skipped accidentally, stop and perform it immediately before continuing.

## Internal docs usage

- Treat `.github/internal/` as project memory.
- Verify time-sensitive facts from source-of-truth files before acting.
- Keep `README.md` product-facing; put internal process notes in `.github/internal/`.

## After meaningful work

Update the most relevant internal file under `.github/internal/` so context is preserved for future chats.

# Workspace Notes For AI Agents

Before making substantial changes, read `.github/internal/project-context.md`.

First-turn protocol (mandatory in every new chat):

- On the first turn, before running git/build/release/code-edit commands, read `.github/AGENTS.md` and `.github/internal/project-context.md`.
- After that, read only the most relevant file under `.github/internal/` for the current task type.
- In the first user update, explicitly confirm which internal files were read.
- If these files were skipped by mistake, pause and run the preflight immediately before continuing substantial work.

Treat `.github/internal/` as the project memory, but use it correctly:

- verify time-sensitive facts from source-of-truth files before acting on them
- use internal docs to avoid re-discovering decisions, pitfalls, and known fixes
- do not copy the same volatile fact into many files if one authoritative place is enough

Then read the most relevant internal note for the task:

- `.github/internal/release-playbook.md` for beta/stable releases, manifests, scheduling, and post-release checks
- `.github/internal/validation-matrix.md` for which checks to run after each kind of change
- `.github/internal/coding-guardrails.md` for editing style, indentation, logic safety, and regression-sensitive UI zones
- `.github/internal/troubleshooting-notes.md` for real break/fix incidents already seen in this repo and how they were resolved
- `.github/internal/decision-log.md` for durable repo decisions that should not be re-debated every chat
- `.github/internal/ideas-backlog.md` for open product ideas, technical follow-ups, and next-step context

Suggested read order:

- start with `project-context.md`
- read `decision-log.md` and `coding-guardrails.md` before risky code changes
- read `troubleshooting-notes.md` when something feels broken or familiar
- read `release-playbook.md` for any release-related task
- read `validation-matrix.md` before choosing what to verify
- read `ideas-backlog.md` only for open follow-ups and non-committed ideas

Rules for this repository:

- Keep `README.md` product-facing. Do not add developer command tables, Android Studio setup steps, or internal release mechanics there.
- When new features are added, describe them in `README.md` only through user value and product language, not through implementation details.
- On releases, review `README.md` and update it only if there is genuine new product-facing value worth selling.
- Put internal instructions, workflow notes, troubleshooting steps, and AI handoff context under `.github/internal/`.
- Use `.github/internal/` as the place for development notes, technical decisions, release mechanics, debugging findings, TODO context, and future feature ideas.
- After meaningful work, update the relevant file in `.github/internal/` so the development thread is not lost between chats.
- Prefer updating one or two relevant internal files over scattering the same note across the whole doc set.
- Record meaningful outcomes, decisions, fixes, known regressions, next steps, and useful ideas there; do not try to log every trivial command or tiny intermediate action.

Update routing after work:

- new durable repo fact or current high-level state: `project-context.md`
- release nuance, visibility rule, or release sequence change: `release-playbook.md`
- new required check or verification habit: `validation-matrix.md`
- new editing risk or regression-prevention rule: `coding-guardrails.md`
- new break/fix case with understood root cause: `troubleshooting-notes.md`
- new repo-wide rule or decision that should persist: `decision-log.md`
- new deferred idea, follow-up, or optional improvement: `ideas-backlog.md`
- Never create, schedule, promote, or trigger beta/stable releases unless the user explicitly asks for that release action.
- When the user explicitly asks to release a beta or stable version, treat that as an end-to-end app-visible release task, not just tag creation or a GitHub release object.
- When changing UI source files in the repo root (`index.html`, `js/`, `styles/`, `data/`), rebuild `www/` before assuming the app is broken.
- Preserve the existing indentation and local style of touched files; do not mass-reformat unrelated code or rewrite working logic just to fit a new idea.
- For Android verification, prefer the repo scripts instead of ad-hoc steps so local patches are reapplied consistently.
- For release work, verify the version and manifest chain before tagging or scheduling releases.
- Remember that GitHub Pages publication is a separate step in this repo; metadata changes on `main` are not enough unless Pages is also deployed.
- Do not consider a release task complete until the manifest served from GitHub Pages matches the released version, because that is what the app checks.
- When you learn something repo-specific that future chats should know, append it to `.github/internal/project-context.md`.
- If you generate or refine product ideas during work, store the useful ones under `.github/internal/` instead of turning `README.md` into an internal notebook.

# Validation Matrix

## Minimum checks by change type

- README or internal-doc changes only: read the final diff and confirm no accidental technical leakage into `README.md`
- Root UI changes (`index.html`, `js/`, `styles/`, `data/`): read `.github/internal/coding-guardrails.md`, run `get_errors` for touched files, and `npm run build:web`
- Update-flow changes: run `get_errors`, `npm run build:web`, and verify manifest/version behavior as needed
- Android or Capacitor changes: run `npm run cap:android`; if the change is deeper, also run Gradle assembly from `android/`
- Workflow or release-script changes: validate syntax, run safe local script checks when possible, and verify the expected remote chain conceptually or with public API checks
- Release work: verify release existence, manifest on `main`, and manifest on GitHub Pages; do not treat the task as done until the Pages manifest matches the released version

## Regression-sensitive UI checks

- If a change touches overlays, modals, navigation, or the `Графіки` area, verify that opening and closing the related UI does not leave the screen untouchable
- If a change touches DOM ids, classes, or buttons, trace the matching JavaScript selectors before renaming anything
- If a change touches classic global scripts, verify you did not introduce duplicated global declarations or ordering-dependent breakage
- If a change touches profiles/graphs UI, verify the relevant button handlers still attach and that the full reset path remains a recovery option

## Quick triage

- App does not see a new update: verify GitHub Pages manifest first, then raw `main`, then release existence
- Browser and Android differ: rebuild web assets, then run `npm run cap:android`
- A UI feature works in source but not in app: suspect stale `www/` or stale Android synced assets
- Something breaks after adding a global script constant: check for duplicated global `const` names across classic scripts
- Graphs, profiles, or update UI feel corrupted: keep the full reset path in mind and verify `SettingsState.hardResetAllData()` behavior

## Documentation checks

- `README.md` should describe user value, not developer steps
- Internal docs should capture development context, decisions, and ideas that may matter in future chats
- After releases, sync both user-facing and AI-facing docs if the release changed what users see or what developers must remember

## Internal doc sync hints

- after a bug fix with a understood root cause, update `troubleshooting-notes.md`
- after discovering a new regression-prevention rule, update `coding-guardrails.md`
- after deciding a repo-wide rule, update `decision-log.md`
- after a release nuance or deployment gotcha, update `release-playbook.md`
- after a useful new validation habit, update `validation-matrix.md`
- after identifying future follow-up work, update `ideas-backlog.md`

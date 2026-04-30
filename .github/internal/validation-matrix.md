# Validation Matrix

## Minimum checks by change type

- README or internal-doc changes only: read the final diff and confirm no accidental technical leakage into `README.md`
- Root UI changes (`index.html`, `js/`, `styles/`, `data/`): read `.github/internal/coding-guardrails.md`, run `get_errors` for touched files, and `npm run build:web`
- JS or script logic changes: run `npm run lint` to catch syntax/reference errors before release work
- Storage snapshot changes: run `npm run lint`, `npm run build:web`, and a focused smoke test for snapshot capture, restore from missing `scheduleConfig`, corrupted JSON recovery, and snapshot clearing
- Update-flow changes: run `get_errors`, `npm run build:web`, and verify manifest/version behavior as needed
- Android or Capacitor changes: run `npm run cap:android`; if the change is deeper, also run Gradle assembly from `android/`
- Workflow or release-script changes: validate syntax, run safe local script checks when possible, and verify the expected remote chain conceptually or with public API checks
- Release metadata changes: run `npm run release:check -- <beta|stable> <version>` and ensure `data/config.js` has a matching `APP_RELEASE_NOTES` entry for that version
- Cloudflare deploy changes: run `npm run build:web`, syntax-check `cloudflare/src/worker.js`, and validate `wrangler.jsonc` with `npx wrangler deploy --dry-run` when credentials/config permit it
- Release work: verify release existence, manifest on `main`, manifest on Cloudflare, and during the migration bridge manifest on GitHub Pages; do not treat the task as done until the Cloudflare manifest matches the released version
- After stable release work, verify `.github/one-time-stable-release.json` is disabled or explicitly retargeted so the scheduler does not keep evaluating stale versions

## Regression-sensitive UI checks

- If a change touches overlays, modals, navigation, or the `Графіки` area, verify that opening and closing the related UI does not leave the screen untouchable
- If a change touches DOM ids, classes, or buttons, trace the matching JavaScript selectors before renaming anything
- If a change touches classic global scripts, verify you did not introduce duplicated global declarations or ordering-dependent breakage
- If a change touches profiles/graphs UI, verify the relevant button handlers still attach and that the full reset path remains a recovery option

## Quick triage

- App does not see a new update: verify Cloudflare manifest first, then raw `main`, then release existence; during the temporary bridge also verify GitHub Pages
- Browser and Android differ: rebuild web assets, then run `npm run cap:android`
- A UI feature works in source but not in app: suspect stale `www/` or stale Android synced assets
- Something breaks after adding a global script constant: check for duplicated global `const` names across classic scripts
- Graphs, profiles, or update UI feel corrupted: keep the full reset path in mind and verify `SettingsState.hardResetAllData()` behavior

## Documentation checks

- `README.md` should describe user value, not developer steps
- Internal docs should capture development context, decisions, and ideas that may matter in future chats
- After releases, sync both user-facing and AI-facing docs if the release changed what users see or what developers must remember
- For beta releases, verify both `beta-X.Y.Z` and `vX.Y.Z-beta` point to the intended source commit when the GitHub release tag is created by workflow

## Internal doc sync hints

- after a bug fix with a understood root cause, update `troubleshooting-notes.md`
- after discovering a new regression-prevention rule, update `coding-guardrails.md`
- after deciding a repo-wide rule, update `decision-log.md`
- after a release nuance or deployment gotcha, update `release-playbook.md`
- after a useful new validation habit, update `validation-matrix.md`
- after identifying future follow-up work, update `ideas-backlog.md`

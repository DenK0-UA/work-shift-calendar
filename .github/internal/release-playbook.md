# Release Playbook

## Policy

- Releases are user-directed only: no beta release, stable promotion, scheduled promotion, tag creation, or workflow dispatch without explicit user instruction
- Default interpretation of a release request in this repo: finish the release until the app can actually see it, not merely until a tag or GitHub release object exists
- On any release task, review `README.md` and update it only if the release adds real user-facing value worth presenting in product language
- Keep release mechanics out of `README.md`; internal release notes belong under `.github/internal/`
- After meaningful release work, update the internal docs so the next chat inherits the real state of the repo

## Source of truth

- App version: `package.json`
- In-app release version and release notes: `data/config.js`
- Android app version name: `android/app/build.gradle`
- Beta manifest: `beta/version.json`
- Stable manifest: `stable/version.json`
- Release workflows: `.github/workflows/`

## Beta release flow

- Ensure the requested version is already set consistently in `package.json`, `data/config.js`, and `android/app/build.gradle`
- Run `node scripts/release-preflight.mjs beta x.y.z`
- Beta release uses tag `beta-x.y.z`
- Verify the GitHub beta release exists and `beta/version.json` is updated
- Verify GitHub Pages serves the updated beta manifest, because that is what the app checks for update visibility
- If the GitHub release exists but Pages still serves the old beta manifest, do not stop there; finish the Pages publication step and re-check the public manifest

## Stable promotion flow

- Stable promotion must target an already-published beta version
- Run `node scripts/release-preflight.mjs stable x.y.z`
- Stable promotion uses tag `stable-x.y.z` or the one-time scheduler path
- Verify the GitHub stable release exists and `stable/version.json` is updated on `main`
- Verify GitHub Pages serves the updated stable manifest, because the app reads manifests from Pages
- If the GitHub release exists but Pages still serves the old stable manifest, the task is still incomplete from the app's perspective

## Scheduled stable promotion

- One-time scheduler config lives in `.github/one-time-stable-release.json`
- Scheduler workflow lives in `.github/workflows/schedule-stable-once.yml`
- Scheduler dispatches `promote-stable.yml` and then `deploy-pages.yml`
- Scheduled time is stored in UTC and GitHub cron can drift by a few minutes
- Keep `enabled: false` in `.github/one-time-stable-release.json` unless you are explicitly preparing a one-time stable release window
- After a scheduled promotion completes, verify the release and disarm or retarget the one-time scheduler config immediately
- If `.github/one-time-stable-release.json` points to an older version than current `stable/version.json`, the scheduler should skip without failing; update or disable the config anyway to avoid confusion

## Release verification checklist

- Treat the task as incomplete until the app-visible manifest on GitHub Pages serves the expected version
- Release exists on GitHub with the expected tag
- `beta/version.json` or `stable/version.json` on `main` has the expected version
- GitHub Pages serves the same expected version
- `README.md` has been reviewed for any new product-facing benefits worth mentioning
- Internal AI docs reflect the new version, workflow findings, and any new gotchas

## Known gotchas

- Tag-triggered workflows run on detached HEAD; metadata commits need a temporary local branch before rebase and push
- GitHub Actions bot pushes to `main` do not reliably trigger Pages deploy in this repo
- A release is not fully visible to the app until GitHub Pages serves the updated manifest
- If a manifest looks stale, re-check with a cache-busting query parameter before assuming the app update flow is broken

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
- Public app base URL: `APP_PUBLIC_BASE_URL` repo variable, defaulting to `https://work-shift-calendar.denidinamo.workers.dev`
- Release APK storage: Cloudflare R2 bucket `work-shift-calendar-releases`, object prefix `downloads/`

## Beta release flow

- Ensure the requested version is already set consistently in `package.json`, `data/config.js`, and `android/app/build.gradle`
- Run `node scripts/release-preflight.mjs beta x.y.z`
- Beta release uses tag `beta-x.y.z`
- Verify the GitHub beta release exists and `beta/version.json` is updated
- Verify `vX.Y.Z-beta` points to the same commit as `beta-X.Y.Z`; if GitHub created it from stale `main`, retarget the release tag to the beta source commit
- Verify the beta APK was uploaded to Cloudflare R2 and `beta/version.json` points to the Cloudflare `/downloads/*.apk` URL
- Verify Cloudflare serves the updated beta manifest, because that is what new app versions check for update visibility
- During the temporary public-repo bridge, also verify GitHub Pages serves the updated beta manifest for older app versions

## Stable promotion flow

- Stable promotion must target an already-published beta version
- Run `node scripts/release-preflight.mjs stable x.y.z`
- Stable promotion normally uses tag `stable-x.y.z`; the one-time scheduler workflow is manual-only and should not run on a cron
- Verify the GitHub stable release exists and `stable/version.json` is updated on `main`
- Verify the stable APK was uploaded to Cloudflare R2 and `stable/version.json` points to the Cloudflare `/downloads/*.apk` URL
- Verify Cloudflare serves the updated stable manifest, because that is what new app versions check for update visibility
- During the temporary public-repo bridge, also verify GitHub Pages serves the updated stable manifest for older app versions

## Manual one-time stable helper

- One-time scheduler config lives in `.github/one-time-stable-release.json`
- Scheduler workflow lives in `.github/workflows/schedule-stable-once.yml`
- Scheduler dispatches `promote-stable.yml` and then `deploy-pages.yml`
- The workflow is manual-only; do not add a cron trigger unless the user explicitly asks for timed stable releases again
- Keep `enabled: false` in `.github/one-time-stable-release.json` unless you are explicitly preparing a manual one-time stable window
- After a manual one-time promotion completes, verify the release and disarm or retarget the one-time scheduler config immediately
- If `.github/one-time-stable-release.json` points to an older version than current `stable/version.json`, the scheduler should skip without failing; update or disable the config anyway to avoid confusion

## Release verification checklist

- Treat the task as incomplete until the app-visible manifest on Cloudflare serves the expected version
- Release exists on GitHub with the expected tag
- `beta/version.json` or `stable/version.json` on `main` has the expected version
- Cloudflare serves the same expected version
- During the temporary migration bridge, GitHub Pages also serves the same expected version
- `README.md` has been reviewed for any new product-facing benefits worth mentioning
- Internal AI docs reflect the new version, workflow findings, and any new gotchas

## Known gotchas

- Tag-triggered workflows run on detached HEAD; metadata commits need a temporary local branch before rebase and push
- `softprops/action-gh-release` may create `vX.Y.Z-beta` from the default branch when `tag_name` differs from the triggering `beta-X.Y.Z` tag; verify and retarget that release tag when needed
- GitHub Actions bot pushes to `main` do not reliably trigger downstream deploys in this repo, so release workflows explicitly dispatch Cloudflare and legacy Pages deployments after metadata commits
- A release is not fully visible to the app until Cloudflare serves the updated manifest
- If a manifest looks stale, re-check with a cache-busting query parameter before assuming the app update flow is broken

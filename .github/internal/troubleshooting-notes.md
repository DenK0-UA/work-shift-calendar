# Troubleshooting Notes

Use this file when something breaks and the repo already taught us a likely fix path.

## Graphs or profiles leave the app untouchable

### Symptoms

- `Графіки` opens or closes, then taps stop working correctly
- overlay-like state remains after closing a panel or modal
- related buttons seem dead even though the UI is visible

### What usually went wrong

- overlay stacking or pointer-event state was left behind after close
- event wiring around profiles UI became inconsistent after HTML or JS drift
- a risky UI change replaced working behavior instead of extending it carefully

### What to check first

- `js/overlay-controller.js`
- `js/profiles-ui.js`
- `js/ui.js`
- `index.html` ids/classes used by the profiles area

### Known fix direction

- verify open and close paths together, not only opening
- preserve guarded listener binding patterns in `js/profiles-ui.js`
- after touching the area, verify `Графіки` can open and close without blocking later taps
- keep the full reset path valid as a recovery option if local state is corrupted

## Profiles or graphs button stops responding

### Symptoms

- the `#profiles-btn` flow stops opening the expected UI
- behavior differs between source and built output

### What usually went wrong

- stale or mismatched HTML and JS
- listener bindings were not guarded and did not attach safely

### Known fix direction

- rebuild generated web assets first
- verify the button selector still exists in HTML
- keep listener binding guarded with presence checks

## Browser build works but Android app still shows old behavior

### Symptoms

- the root source looks correct but Android still behaves like older code
- CSS or logic appears fixed in browser but unchanged on device

### What usually went wrong

- `www/` was stale
- Capacitor Android assets were not resynced after rebuilding the web app

### Known fix direction

- run `npm run build:web` after root web edits
- for Android verification, use `npm run cap:android` instead of assuming `build:web` alone is enough

## A classic front-end script suddenly breaks later files

### Symptoms

- unrelated later script stops running
- browser throws a syntax error before later UI features initialize

### What usually went wrong

- duplicated top-level `const` or another global declaration across classic scripts

### Known fix direction

- search for duplicated global names across root scripts
- avoid introducing new top-level names casually in classic non-module files

## Beta channel block shows for users who should not see it

### Symptoms

- anonymous or non-allowlisted users still see the update-channel block in Settings

### What usually went wrong

- beta access state stayed stale in memory because allowlist state was not forcibly refreshed

### Known fix direction

- refresh the beta access state on page load and when opening Settings
- force `loadBetaAccessState(true)` when the UI needs current truth
- use `hidden = !betaAllowed` with a display fallback so hidden state is enforced visually

## App does not see a newly published release

### Symptoms

- release exists on GitHub but the app still says no update is available
- raw repo files and app-visible state disagree

### What usually went wrong

- GitHub Pages still serves the old manifest
- a bot metadata push updated `main` but did not deploy Pages
- cached manifest checks caused confusion during manual verification

### Known fix direction

- verify GitHub Pages manifest first, then raw `main`, then release existence
- add a cache-busting query parameter when verifying manifests manually
- remember the app reads manifests from GitHub Pages, not from raw GitHub as the primary user-facing source
- if needed, trigger or verify `deploy-pages.yml` separately

## Scheduled or automated release looks incomplete

### Symptoms

- tag or release exists, but the app still does not see the new version
- scheduled promotion appears to run, but stable visibility lags

### What usually went wrong

- Pages deployment was not the final visible step yet
- the scheduled workflow hit normal GitHub cron drift when cron scheduling was still enabled

### Known fix direction

- verify the full chain: release tag, manifest on `main`, manifest on Pages
- historical note: when cron scheduling was enabled, drift of a few minutes was expected
- after scheduled stable promotion, re-check whether the one-time config should be updated or disarmed

## Schedule One-Time Stable Release keeps failing after stable is already live

### Symptoms

- `Schedule One-Time Stable Release` runs for ~20 minutes then fails on timeout
- logs show repeated `Stable release metadata is still pending` while `main/release/pages` already have a newer stable version

### What usually went wrong

- `.github/one-time-stable-release.json` remained enabled with an older target version (for example `1.0.46`) after later stable releases were already published

### Known fix direction

- set `.github/one-time-stable-release.json` to `enabled: false` unless a manual one-time stable promotion is being actively prepared
- when scheduling again, update `version`, `releaseAtUtc`, and `notes` together
- keep scheduler script behavior tolerant to stale one-time targets so stale config does not fail the workflow
- current policy: `.github/workflows/schedule-stable-once.yml` is manual-only and should not run every 5 minutes

## Android patching breaks Gradle unexpectedly

### Symptoms

- Android build breaks after changing patch logic or modernizing Gradle syntax

### What usually went wrong

- a Groovy DSL form was converted too aggressively, even though it was not an assignment

### Known fix direction

- patch Gradle files conservatively
- do not blindly convert every Groovy call-like form into `name = ...`
- preserve special DSL forms such as `baseline file(...)` when required by the upstream config

## Remaining Android warning debt

### State

- not all warnings were project-owned bugs
- after cleanup, the main remaining warning family was `flatDir`

### What to remember

- this is known technical debt, not a surprise regression
- if cleanup resumes later, inspect app-module and generated Cordova-module `flatDir` usage before changing anything else

# Internal Project Context

This file is the internal working context for future chats and AI agents.

Purpose:

- keep `README.md` focused on selling the app to users
- keep operational notes, repo quirks, release flow, handoff context, and development ideas here
- reduce repeated archaeology in new chats

## How to use this memory

- Treat this internal doc set as project memory, not as a substitute for current source-of-truth files
- Use it to recover decisions, pitfalls, known fixes, validation habits, and open threads quickly
- Re-check time-sensitive state before acting, especially versions, manifests, workflow state, and release configuration
- Prefer one authoritative location per kind of note so the internal docs do not drift against each other

## What should be recorded

- meaningful decisions that future chats should preserve
- bugs, breakages, root causes, and known fix directions
- release nuances, validation habits, and recurring repo pitfalls
- next-step context that would otherwise need to be re-explained later
- worthwhile product or technical ideas that may come back in future work

## What should not be recorded verbatim

- every small terminal command or one-off exploratory check
- low-signal intermediate steps that do not matter after the task is done
- duplicated volatile state already covered by a better source-of-truth file
- guesses presented as facts

## Internal doc map

- `project-context.md` is the high-level snapshot and starting point for new chats
- `release-playbook.md` is the source for release policy, flow, and verification
- `validation-matrix.md` says what to verify for each kind of change
- `coding-guardrails.md` documents editing discipline, style/indentation expectations, and logic regressions to avoid
- `troubleshooting-notes.md` records real incidents, breakages, root causes, and known fix directions from previous work
- `decision-log.md` stores durable decisions that future chats should preserve
- `ideas-backlog.md` stores open product ideas, technical follow-ups, and future work worth revisiting

## Doc routing guide

- update `project-context.md` when the high-level state of the repo changes in a way future chats should know quickly
- update `release-playbook.md` when release steps, release visibility, or post-release verification rules become clearer
- update `validation-matrix.md` when a new minimum check or verification pattern proves useful
- update `coding-guardrails.md` when a risky editing pattern or regression-prevention rule becomes clear
- update `troubleshooting-notes.md` when a break/fix case has a known root cause and a reliable recovery direction
- update `decision-log.md` when a repo rule or product/process decision should survive future chats
- update `ideas-backlog.md` when there is a worthwhile follow-up, optional improvement, or idea that is not committed scope yet

## Freshness rules

- `project-context.md` may contain dated snapshot facts; verify them before release or high-risk work
- `decision-log.md` and `coding-guardrails.md` are the most durable internal files
- `troubleshooting-notes.md` should capture incidents that already happened and were understood, not guesses
- `ideas-backlog.md` can contain speculative items and must not be treated as committed scope
- Release state should always be re-checked against current files and public endpoints before acting

## Current state

- Date of this snapshot: `2026-04-18`
- App version in source files: `1.0.52`
- Beta manifest version: `1.0.52`
- Stable manifest version: `1.0.52`
- One-time stable scheduler config is now disarmed by default (`enabled: false`) and should only be armed for explicit one-time stable windows

## Recent user-visible work

- `1.0.45` focused on stability and update UX polish
- `1.0.46` added the post-update `Що нового` block, faster day-modal navigation, note-state UX, and expanded statistics
- `1.0.47` polished side gutters and spacing across breakpoints on mobile
- `1.0.48` improved update UX and day-modal swipe discoverability
- `1.0.49` hardened local storage reads/writes and data normalization
- `1.0.50` temporarily switched fallback update behavior to direct APK links
- `1.0.51` hid disabled extra profiles from the day modal list
- `1.0.52` moved update UX back to GitHub release-page flow with clearer Assets guidance for non-technical users
- README was intentionally rewritten to be product-facing instead of developer-facing

## Product and documentation rules

- Keep `README.md` sales-oriented and user-facing
- When new functionality is shipped, update `README.md` with benefits and outcomes for the user, not internal implementation details
- During release work, review `README.md` and update it if the release contains real new product-facing value that deserves to be sold
- Do not document internal release commands, Android setup steps, or CI wiring in `README.md`
- Put development notes, internal process notes, implementation decisions, debugging findings, and feature ideas here or in another file under `.github/internal/`
- Keep the internal AI docs updated continuously after meaningful work so new chats do not lose the thread of development

## Development and idea capture

- Use this internal area to store the thread of development between chats
- Record partial decisions, next-step context, architecture notes, and ideas worth revisiting
- If an idea is only exploratory, mark it clearly as an idea instead of a confirmed plan
- Prefer keeping user-facing marketing copy in `README.md` and everything builder-facing here

## Repository shape

- Root web source lives in `index.html`, `js/`, `styles/`, and `data/`
- Generated web output lives in `www/`
- Android wrapper lives in `android/`
- Release and build scripts live in `scripts/`
- GitHub Actions live in `.github/workflows/`

## Build and validation rules

- `npm run build:web` recreates `www/` from the root source via `scripts/build-web.mjs`
- If browser and Android behavior differ, first suspect stale generated files in `www/` or stale synced Android assets
- `npm run cap:android` is the reliable refresh path for Android because it rebuilds the web app, syncs Capacitor, and reapplies local Android Gradle patches
- `npm run android:live` also syncs and reapplies patches before launching live reload

## Front-end gotchas

- Front-end scripts are classic global scripts, not ES modules
- Reusing a global `const` name across different files can break later script loading with a browser syntax error
- Keep DOM listener bindings guarded where stale HTML or partial loads could leave elements missing
- In UI work, preserve selector names, event wiring, overlay behavior, and close/open flows unless you have traced every dependent path first

## App update and release flow

- App update manifests are served from GitHub Pages, not directly from the raw repo during normal app use
- `js/app-update.js` uses `cache: 'no-store'` and a cache-busting query param when checking manifests
- Release notes shown in-app live in `data/config.js` under `APP_RELEASE_NOTES`
- Releases are user-directed only: do not create beta tags, stable tags, scheduled promotions, or release dispatches unless the user explicitly tells you to do it
- In this repo, a user request to "release beta/stable" means finishing the app-visible release path, not stopping at a tag or GitHub release page
- Beta release flow uses `beta-x.y.z` tags
- Stable promotion uses `stable-x.y.z` tags or the one-time scheduler flow
- `promote-stable.yml` promotes the beta APK to stable, updates `stable/version.json`, and commits metadata back to `main`
- `deploy-pages.yml` publishes the repo to GitHub Pages so the app can see updated manifests

## Release workflow gotchas

- Tag-triggered workflows run on detached HEAD; metadata commits need a temporary local branch before rebase and push
- In this repo, GitHub Actions bot pushes to `main` do not reliably trigger Pages deploy, so explicit Pages dispatch may still be required
- `.github/workflows/schedule-stable-once.yml` polls every 5 minutes and dispatches `promote-stable.yml`, then dispatches `deploy-pages.yml`
- GitHub cron is not second-accurate; scheduled releases can drift by a few minutes
- If `.github/one-time-stable-release.json` is left enabled with an old version, scheduled runs can time out in metadata wait loops unless stale-version guards are present; keep one-time config disarmed when idle

## Android and Gradle notes

- Local Android compatibility patching is handled by `scripts/patch-capacitor-android.mjs`
- Recent Gradle cleanup reduced project-owned warnings substantially
- If Android warning cleanup resumes later, remaining focus is the `flatDir` usage in the app and generated Cordova module

## Reset and recovery notes

- `SettingsState.hardResetAllData()` is expected to clear schedule data, profile data, app update keys, session copies, caches, and service workers
- If something in graphs/profiles/update UI behaves inconsistently, a full reset path should remain a valid recovery option

## How to extend this file

- Add only verified repo-specific facts
- Prefer short bullets over long prose
- Update version and release state when the repo ships a new beta or stable
- Record pitfalls that actually caused wasted time, breakage, or debugging churn
- Add durable development context and worthwhile product ideas if they may save time in future chats
- If a fact is volatile or task-specific, consider whether another internal file is a better home than duplicating it here

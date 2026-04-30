# Work Shift Calendar

Static work shift calendar web app, wrapped for Android with Capacitor. Hosted on Cloudflare Workers.

## Commands

```bash
npm run dev:web         # Vite dev server on :4173
npm run build:web       # Rebuild www/ from source (index.html, js/, styles/, data/, stable/, beta/)
npm run lint            # ESLint

npm run cap:android     # build:web + cap sync + patch Android Gradle — use this for Android testing
npm run android:live    # Live-reload on device (also syncs and patches Android)

npm run version:set -- <x.y.z>         # Sync version across package.json, data/config.js, android/build.gradle
npm run release:check -- beta <x.y.z>  # Run preflight checks before tagging
npm run release:beta -- <x.y.z>        # Tag beta-x.y.z and push (triggers CI)
npm run release:stable -- <x.y.z>      # Tag stable-x.y.z and push (promotes beta APK to stable via CI)
```

## Architecture

```
index.html          # App shell
js/                 # Front-end source (vanilla global scripts — NOT ES modules)
styles/             # CSS
data/               # config.js (version, update URLs, release notes), schedule data
www/                # GENERATED — rebuilt by build:web; never edit directly
android/            # Capacitor Android wrapper
beta/               # beta/version.json — beta update manifest
stable/             # stable/version.json — stable update manifest
scripts/            # Node build/release scripts
.github/workflows/  # CI: release-beta, promote-stable, deploy-cloudflare, deploy-pages
.github/internal/   # AI agent memory — project context, release playbook, coding guardrails
```

## Critical Gotchas

- **Global scripts only**: `js/` files use classic `<script>` globals. Duplicate `const` names across files cause silent load failures.
- **storage-snapshots.js load order**: `js/storage-snapshots.js` must load before `schedule.js` — it restores corrupted localStorage before the app hydrates state.
- **www/ is generated**: `build:web` wipes and recreates it. Changes there are lost on next build.
- **Version must be consistent**: `package.json`, `data/config.js` (`APP_RELEASE_VERSION`), and `android/app/build.gradle` (`versionName`/`versionCode`) must all match. `release:check` enforces this.
- **Release notes required**: `data/config.js` must have an `APP_RELEASE_NOTES` entry for the current version or preflight fails.
- **Beta before stable**: stable promotion requires `beta/version.json` to already be on that version.
- **Releases are CI-driven**: tagging triggers GitHub Actions. Do not run release workflows locally.
- **App reads manifests from Cloudflare**: a release isn't visible to users until Cloudflare serves the updated `version.json`.

## Release Flow

1. `npm run version:set -- x.y.z` — sync version in all three files
2. Add `APP_RELEASE_NOTES` entry for `x.y.z` in `data/config.js`
3. `npm run release:beta -- x.y.z` — run locally: validates preflight, pushes `beta-x.y.z` tag; CI then builds APK, uploads to R2, updates `beta/version.json`, deploys Cloudflare
4. `npm run release:stable -- x.y.z` — run locally: pushes `stable-x.y.z` tag; CI copies beta APK to stable, updates `stable/version.json`, deploys Cloudflare

See `.github/internal/release-playbook.md` for full verification checklist.
See `.github/internal/project-context.md` for current version state and repo context.

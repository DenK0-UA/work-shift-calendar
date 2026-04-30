# Decision Log

- `2026-04-06`: `README.md` is product-facing only and should not be used as a developer handbook
- `2026-04-06`: Internal AI-facing notes live under `.github/internal/` and should carry the real development thread between chats
- `2026-04-06`: The internal docs are project memory, but time-sensitive state must still be verified from current source-of-truth files before acting
- `2026-04-06`: Releases are performed only on direct user command; do not self-initiate beta or stable publishing
- `2026-04-06`: GitHub Pages must be treated as a separate visibility step for app updates, not as an automatic side effect of metadata commits
- `2026-04-06`: A user request to release beta/stable means end-to-end app-visible release completion, not just tag creation or a GitHub release page
- `2026-04-06`: If a release adds user-visible value, review `README.md` and add only the product-facing benefits worth selling
- `2026-04-06`: Internal AI docs should be kept continuously updated after meaningful work so context is not lost across sessions
- `2026-04-06`: Do not scatter the same volatile fact across many internal files when one authoritative location is enough
- `2026-04-06`: Every new chat must run a first-turn AI preflight (`.github/AGENTS.md` + `.github/internal/project-context.md` + one task-relevant internal file) before substantial work
- `2026-04-18`: `.github/one-time-stable-release.json` must stay disarmed (`enabled: false`) unless a user explicitly requests a one-time scheduled stable release window
- `2026-04-29`: New update/hosting direction is Cloudflare Workers for web/manifests plus Cloudflare R2 for APK files; GitHub Pages remains only as a temporary bridge while older installed versions migrate
- `2026-04-29`: Keep `work-shift-calendar` public for roughly 2 weeks after the Cloudflare migration release, then make the repository private once existing installs have had time to update
- `2026-04-29`: Android updates should use direct APK downloads through the native `ApkDownload` plugin, with a direct APK URL fallback instead of sending users to GitHub release pages
- `2026-04-30`: User-data protection should first use automatic local snapshots rather than user-facing JSON import/export, because simple users should not need to manage backup files for normal recovery
- `2026-04-30`: Stable releases are user-directed only; `.github/workflows/schedule-stable-once.yml` must remain manual-only and should not run on a recurring cron

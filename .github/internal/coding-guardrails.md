# Coding Guardrails

Use this file to avoid breaking working behavior while implementing new ideas.

## Editing discipline

- Preserve the existing indentation style of the touched file
- Match the local code style instead of reformatting large unrelated regions
- Prefer small, surgical edits over broad rewrites
- Fix the root cause, but do not opportunistically refactor unrelated logic during risky UI work
- If a change affects multiple layers, trace the full path first instead of patching one file blindly

## Style and structure rules

- Keep root source files in sync conceptually with generated output expectations; after root UI edits, rebuild `www/`
- Do not rename ids, classes, storage keys, or global symbols casually; first find all call sites and dependent behavior
- In classic non-module scripts, avoid introducing new top-level names that can collide with existing globals
- Preserve guard patterns around DOM listeners when elements may be absent or stale

## Logic safety rules

- New ideas should extend working behavior, not replace stable logic without verification
- If you touch overlays, menus, drawers, or modals, verify both open and close paths
- If you touch navigation or Android back handling, verify that UI layers close in the correct order before app exit behavior
- If you touch update flow, verify manifest reading, version comparison, and release-notes behavior together
- If you touch reset logic, preserve the ability to recover from corrupted local state

## Graphs and profiles regression notes

- The `Графіки` / profiles area has already suffered from dead-tap regressions after UI open/close cycles
- Be careful with overlay stacking, pointer-event behavior, and event listener attachment in profiles-related UI
- `js/profiles-ui.js` listener bindings should stay guarded so stale HTML or partial loads do not break the `#profiles-btn` flow
- After touching related UI, verify that opening and closing `Графіки` does not leave the app stuck or untouchable

## High-risk zones to verify after edits

- `index.html` structure used by multiple scripts
- `js/overlay-controller.js`
- `js/native-back.js`
- `js/profiles-ui.js`
- `js/app-update.js`
- `js/calendar.js`
- `js/ui.js`

## Minimal regression checklist

- Main buttons still respond after opening and closing overlays
- `Графіки` opens, closes, and does not block later taps
- Day modal still opens, navigates, and saves notes correctly
- Android back behavior still closes overlays before exiting
- Update-related UI still shows or hides the right blocks
- No duplicated global declarations were introduced across classic scripts

## When to slow down

- If a new idea requires changing ids/selectors used across HTML, JS, and CSS, trace references first
- If behavior depends on layered UI state, inspect the controller files before editing
- If the fix starts to look like a rewrite, stop and reduce the scope to the smallest safe change

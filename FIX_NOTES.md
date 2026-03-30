# Beta Channel Block Fix - User Notes

## What Was Fixed
The "Канал оновлень" (Update Channel) block is now properly hidden for anonymous users who are not in the beta allowlist.

## How It Works
- When you reload the page, the app automatically fetches the current beta allowlist from GitHub Pages
- Your device ID is checked against the list of authorized beta users
- If you're not authorized, the channel block remains hidden
- When you open Settings, the allowlist is fetched fresh again to ensure accuracy

## What Changed in the Code
1. **Page Load**: Automatic allowlist refresh ensures correct state on initial load
2. **Settings Modal**: Fresh allowlist check whenever you open Settings
3. **Block Visibility**: Controlled through both HTML `hidden` attribute and CSS `display:none` backup
4. **Error Handling**: If allowlist fails to load, block is hidden by default (safe fallback)

## For Users
- Clear browser cache (Ctrl+Shift+Delete) if you see stale behavior
- Reload page (Ctrl+F5 for hard refresh) to get latest state
- Open DevTools (F12) and check Console for debug logs if issues persist

## For Developers
Debug console will show:
- `[AppUpdate] Loading beta access state (force=true)` - when allowlist is being fetched
- `[AppUpdate] Beta check: { installId, isAllowed, allowedCount }` - result of device ID check
- `[AppUpdate] Channel group visibility: { betaAllowed, shouldHide, ... }` - UI state update
- `[AppUpdate] Settings clicked, refreshing UI` - when Settings modal opens

## Files Modified
- js/ui.js: Added refresh logic with error handling
- js/app-update.js: Added debug logging
- index.html: Minor structure updates
- styles/*.css: Layout refinements

Commit: e79f0f9
Date: 2026-03-30

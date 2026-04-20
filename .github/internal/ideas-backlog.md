# Ideas And Backlog

Use this file for open ideas and follow-up work that is not yet a committed plan.

## Status guide

- `idea`: worth remembering, not committed
- `investigating`: actively being explored
- `planned`: likely next work, but not done
- `blocked`: known follow-up with an external blocker
- `done`: implemented already and can later be pruned if stale
- `rejected`: considered and intentionally not pursued

## Product ideas

- `idea`: **Міграція на PWA** — відмовитись від APK/Capacitor на користь PWA. GitHub Pages вже є, сервіс-воркер вже є. Потрібно додати `manifest.json` + іконки (192x192, 512x512). Основна перевага: спрощений release flow без Gradle/keystore/CI для APK.

- `idea`: **Google акаунт + хмарне зберігання** — як частина PWA-міграції або окремо. Варіанти:
  - **Google Drive API** (простіше): зберігати `shift-calendar-data.json` у прихованій AppData папці Drive юзера. Юзер не бачить файл напряму.
  - **Firebase Firestore** (правильніше): реалтайм БД, безкоштовний tier 50k reads/день.
  - Переваги: синхронізація між пристроями, автоматичний бекап, дані не губляться при видаленні апки.
  - Потрібно: Google OAuth (client ID в Google Console), офлайн-стратегія з вирішенням конфліктів при синхронізації.
  - **Storage надійність у PWA**: якщо юзер встановив PWA (додав на екран) і є `navigator.storage.persist()` — дані захищені так само як в APK. Без встановлення — є ризик очищення браузером.

## Technical follow-ups

- `planned`: remove the remaining Android `flatDir` warnings if the cleanup is resumed later
- `idea`: evaluate whether the generated `capacitor-cordova-android-plugins` module can be simplified or removed safely if it remains effectively empty
- `planned`: after the scheduled stable `1.0.46` promotion completes, verify the full public release chain and then decide whether to disarm or reuse the one-time scheduler config

## Process and documentation follow-ups

- `planned`: keep `README.md` sales-oriented on releases and only add new product-facing benefits when a release genuinely changes the app in a way worth selling
- `planned`: keep `.github/internal/` updated continuously with decisions, checks, and ideas so new chats inherit real context instead of re-discovering it

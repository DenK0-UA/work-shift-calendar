# work-shift-calendar

Статичний вебзастосунок для ведення змінного графіка, перегляду календаря, ручного коригування статусів днів і збереження нотаток.

## Можливості

- Готові цикли `5/5`, `4/4`, `5/2`, `3/3`, `2/2`
- Кастомний графік зі своїми робочими та вихідними днями
- Обов'язковий стартовий вибір графіка для нових користувачів
- Календар місяця зі статистикою періоду
- Ручна зміна статусу окремого дня
- Нотатки для конкретних дат
- Позначення державних свят
- Прогноз погоди через `Open-Meteo`
- Збереження графіка, нотаток, ручних змін і вигляду в `localStorage`

## Поточна поведінка

- Якщо графік ще не налаштований, спочатку відкривається екран `📅 Ваш Графік`
- Поки користувач не обере графік і не застосує його, основний календар не показується
- Екран `🎨 Вигляд` відповідає за тему, кольори днів і візуальні дії
- Режим теми `Авто` бере поточну тему пристрою через `prefers-color-scheme`
- Інтерфейс використовує один канонічний стиль `Current`
- Верхній тулбар `📅 / 🎨 / 🌓` зведений до одного типу icon-кнопок
- Основні дії зведені до спільної системи `icon / secondary / primary / danger`

## Вигляд і скидання

У вікні `🎨 Вигляд` доступно:

- перемикання режиму теми: `Авто`, `Світла`, `Темна`
- зміна кольору робочих і вихідних днів
- `Скинути тему`, що скидає тему й кольори до базового вигляду
- повне очищення локальних даних через утримання кнопки `Hard reset` протягом `2` секунд із додатковим підтвердженням

`Hard reset` очищає:

- `scheduleConfig`
- `customDayStatuses`
- `dayNotes`
- кеш свят
- візуальні налаштування теми й кольорів

## Структура

```text
work-shift-calendar/
├── data/
├── js/
│   ├── calendar.js
│   ├── insights.js
│   ├── schedule-ui.js
│   ├── schedule.js
│   ├── settings-state.js
│   ├── ui.js
│   ├── weather.js
│   └── ...
├── styles/
│   ├── calendar.css
│   ├── layout.css
│   ├── modal-day.css
│   ├── responsive.css
│   ├── schedule-panel.css
│   ├── settings-panel.css
│   └── theme.css
├── index.html
└── README.md
```

## Запуск

Проєкт не потребує збірки.

```bash
start index.html
```

Або:

- відкрити `index.html` напряму в браузері
- запустити через `Live Server` у редакторі

## Android через Capacitor

Проєкт підготовлено для запуску як Android-застосунок через `Capacitor`.

### Що вже додано

- `package.json` зі скриптами для підготовки веб-асетів
- `capacitor.config.json`
- Android-проєкт у папці `android/`
- проміжна папка `www/` генерується автоматично зі статичних файлів

### Встановлення

Потрібні:

- `Node.js 18+`
- `Java (JDK 17 рекомендовано)`
- `Android Studio`

Перший запуск:

```bash
npm install
npm run cap:android
npm run android:open
```

### Перший запуск в Android Studio

Для першої збірки краще спочатку відкрити Android Studio, а вже потім користуватись `gradlew`.

1. Встановіть `Android Studio` для `Apple Silicon`, якщо у вас Mac на `M1/M2/M3`
2. Під час першого запуску дозвольте встановити:
   - `Android SDK`
   - `Android SDK Platform`
   - `Android SDK Build-Tools`
   - `Android SDK Command-line Tools`
   - `Android Emulator`
3. Відкрийте Android-проєкт через:

```bash
npm run android:open
```

4. Дочекайтесь `Gradle Sync`
5. Після цього можна збирати `APK` як з Android Studio, так і з термінала

### Корисні команди

Зібрати веб-частину для Capacitor:

```bash
npm run build:web
```

Підняти локальний dev-сервер для live reload:

```bash
npm run dev:web
```

Запустити Android-застосунок на телефоні з live reload:

```bash
npm run android:live
```

Синхронізувати зміни в Android-проєкт:

```bash
npm run cap:android
```

Відкрити нативний Android-проєкт в Android Studio:

```bash
npm run android:open
```

### Швидкі візуальні правки без нового APK

Для правок `HTML/CSS/JS` не потрібно щоразу збирати новий `APK`.

1. Встановіть залежності:

```bash
npm install
```

2. У першому терміналі запустіть локальний сервер:

```bash
npm run dev:web
```

3. Підключіть телефон до тієї ж `Wi-Fi` мережі, що й комп'ютер.

4. У другому терміналі запустіть:

```bash
npm run android:live
```

Поведінка:

- застосунок відкриється на телефоні через локальний сервер
- зміни у `index.html`, `js/`, `styles/` і `data/` будуть підтягуватись без нового `APK`
- цей режим зручний саме для візуальних правок і швидкої перевірки UI
- для релізної збірки, змін у `AndroidManifest`, іконках, splash або іншому нативному коді все ще потрібен звичайний `cap:android` / новий білд

За потреби можна вручну задати IP або порт у `PowerShell`:

```bash
$env:CAP_LIVE_HOST="192.168.0.25"
$env:CAP_LIVE_PORT="4173"
npm run android:live
```

### Як далі збирати APK

Перед новою збіркою, якщо правка має піти на телефон як окрема версія, спочатку оновіть номер версії однією командою:

```bash
npm run version:set -- 1.0.1
```

Це синхронно оновлює:

- `package.json`
- `data/config.js`
- `android/app/build.gradle`

`beta/version.json` і `stable/version.json` оновлюються релізними workflow після тегів `beta-X.Y.Z` / `stable-X.Y.Z`.

1. Запустіть `npm run cap:android`
2. Відкрийте Android Studio через `npm run android:open`
3. Дочекайтесь Gradle Sync
4. Зберіть `APK` або `AAB` через меню `Build`

Або з термінала:

```bash
cd android
./gradlew assembleDebug
```

Готовий debug APK зазвичай буде тут:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### Важливо

- папка `www/` не комітиться, вона генерується автоматично
- після змін у `index.html`, `js/`, `styles/` або `data/` потрібно знову запускати `npm run cap:android`
- перед кожним push / заливом у репозиторій оновлюйте `README.md` під актуальний стан функцій і релізного флоу
- для швидких UI-правок замість цього краще використовувати зв'язку `npm run dev:web` + `npm run android:live`
- локальні дані застосунку, як і раніше, зберігаються локально на пристрої
- вихідники для Android-іконки та splash лежать у `assets/android/`

### Перевірка нової версії APK

У застосунку є банер перевірки оновлень для Android з двома каналами:

- `stable` за замовчуванням для всіх користувачів
- `beta` тільки для пристроїв, чий `installId` додано в allowlist

Рекомендований флоу:

1. локально перевіряєте UI через `npm run dev:web` + `npm run android:live`
2. коли правка готова до тесту на телефоні, піднімаєте версію через `npm run version:set -- 1.0.1`
3. збираєте beta APK (`work-shift-calendar-<version>-beta.apk`) і публікуєте його в `beta`
4. `Beta` доступний тільки на пристроях, чий `installId` є в allowlist
5. після апруву або публікуєте той самий білд у `stable`, або збираєте `work-shift-calendar.apk`
6. усі інші пристрої отримують звичне сповіщення про нову версію

Щоб його увімкнути в реальному середовищі:

1. У `data/config.js` задайте актуальну версію:

```js
const APP_RELEASE_VERSION = "1.0.0";
```

2. Там само вкажіть канал за замовчуванням і URL маніфестів:

```js
const APP_UPDATE_CHANNEL_DEFAULT = "stable";
const APP_UPDATE_MANIFEST_URLS = {
  stable: "https://<user>.github.io/work-shift-calendar/stable/version.json",
  beta: "https://<user>.github.io/work-shift-calendar/beta/version.json",
};
const APP_UPDATE_BETA_ACCESS_URL =
  "https://<user>.github.io/work-shift-calendar/beta/access.json";
```

3. Розмістіть на `GitHub Pages` два файли з однаковою структурою:

- `stable/version.json`
- `beta/version.json`
- `beta/access.json`

Приклад для будь-якого каналу:

```json
{
  "version": "1.0.1",
  "apkUrl": "https://example.com/work-shift-calendar/releases/work-shift-calendar-1.0.1.apk",
  "notes": "Додано нові зміни та виправлення."
}
```

Приклад allowlist для beta:

```json
{
  "allowedInstallIds": ["demo-install-id-1", "demo-install-id-2"]
}
```

Поведінка:

- перевірка виконується при відкритті Android-застосунку
- усі пристрої за замовчуванням перевіряють тільки `stable/version.json`
- `beta` блок з’являється тільки на пристроях, чий `installId` є в `beta/access.json`
- якщо пристрою немає в allowlist, він не бачить перемикач `Beta` і не отримує beta-оновлення
- якщо пристрій є в allowlist, він може перейти на `beta` і перевіряти `beta/version.json`
- якщо у вибраному каналі версія новіша за `APP_RELEASE_VERSION`, показується кнопка `Завантажити APK`
- якщо натиснути `Пізніше`, банер сховається на 24 години, а потім з’явиться знову, якщо APK досі не оновлено
- при кожному релізі нового `APK` запускайте `npm run version:set -- x.y.z`, щоб оновити версію застосунку; маніфести каналів оновлюються релізними workflow
- `beta` можна використовувати для особистої перевірки до того, як реліз піде на всіх
- якщо `version.json` або `apkUrl` лежать на іншому домені, той домен має дозволяти `CORS`; найпростіше тримати маніфест на тому ж хостингу, що й сайт

### GitHub-схема для релізів

Зручно тримати:

- `GitHub Pages` для `stable/version.json` і `beta/version.json`
- `GitHub Releases` для самих `APK`

Приклад:

- beta маніфест веде на `beta`-APK, який бачать тільки пристрої з allowlist
- після апруву той самий або новий `APK` публікується як stable
- усі пристрої на каналі `stable` отримують звичний банер оновлення

### Автоматичні релізи через GitHub Actions

У репозиторії є два workflow:

- `Release Beta APK` збирає новий підписаний `beta`-APK, створює `GitHub Release` з тегом `vX.Y.Z-beta` і сам оновлює `beta/version.json`
- `Promote Beta To Stable` бере вже перевірений `beta`-APK, публікує його як stable-реліз з тегом `vX.Y.Z` і сам оновлює `stable/version.json`

Практичний флоу через GitHub UI:

1. У GitHub відкрийте `Actions` -> `Release Beta APK`
2. Вкажіть нову версію, наприклад `1.0.12`
3. Дочекайтесь завершення workflow і перевірте beta-оновлення на телефоні
4. Якщо все добре, відкрийте `Actions` -> `Promote Beta To Stable`
5. Вкажіть ту саму версію, наприклад `1.0.12`
6. Після завершення workflow stable-користувачі побачать оновлення в застосунку

Практичний флоу без GitHub UI:

1. Для нової тестової збірки запустіть:

```bash
npm run release:beta -- 1.0.16
```

2. Для публікації вже перевіреної версії для всіх запустіть:

```bash
npm run release:stable -- 1.0.16
```

Поведінка:

- перед створенням тега запускається preflight-перевірка
- команда створює і пушить git-тег `beta-1.0.16` або `stable-1.0.16`
- GitHub Actions сам запускає відповідний workflow
- `beta` лишається каналом для тестерів
- `stable` оновлюється тільки окремою командою після вашого апруву

Окремо preflight можна прогнати вручну:

```bash
npm run release:check -- beta 1.0.16
```

Для цього один раз треба додати GitHub Secrets:

- `ANDROID_KEYSTORE_BASE64` - ваш release keystore у форматі base64
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Без цих секретів GitHub не зможе зібрати підписаний релізний `APK`.

## GitHub Pages

У репозиторії є workflow для публікації через `GitHub Pages` з гілки `main`.

- після `push` у `main` сайт оновлюється автоматично
- у налаштуваннях репозиторію для `Pages` має бути вибране джерело `GitHub Actions`

## Як користуватись

1. При першому запуску виберіть свій графік і дату початку циклу.
2. Переглядайте місяці кнопками навігації.
3. Натискайте на день, щоб відкрити деталі, змінити статус або додати нотатку.
4. Відкрийте `📅 Ваш Графік`, щоб змінити цикл або дату старту.
5. Відкрийте `🎨 Вигляд`, щоб змінити тему й кольори днів.

## Примітки

- для оновлення погоди потрібен доступ до `api.open-meteo.com`
- без інтернету календар, графік, нотатки й локальні дані працюють далі, але прогноз погоди не оновлюється
- застосунок побудований на `HTML`, `CSS` і `Vanilla JavaScript`

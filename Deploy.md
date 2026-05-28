# Deploy guide — SNOW screenshot extension

Инструкция по локальной отладке и публикации в Chrome Web Store. Документ
парный к [`PLAN.md`](PLAN.md) и предполагает структуру репозитория, которая
описана там же.

---

## Содержание

1. [Предварительные требования](#1-предварительные-требования)
2. [Настройка Google Cloud Console (один раз)](#2-настройка-google-cloud-console-один-раз)
3. [Локальная отладка (load unpacked)](#3-локальная-отладка-load-unpacked)
4. [Smoke‑тесты после загрузки](#4-smokeтесты-после-загрузки)
5. [Подготовка прод‑сборки](#5-подготовка-прод-сборки)
6. [Публикация в Chrome Web Store](#6-публикация-в-chrome-web-store)
7. [Обновление уже опубликованной версии](#7-обновление-уже-опубликованной-версии)
7.5. [Автопубликация через GitHub Actions](#75-автопубликация-через-github-actions)
8. [Привязка стабильного Extension ID (поле `key`)](#8-привязка-стабильного-extension-id-поле-key)
9. [Troubleshooting](#9-troubleshooting)
10. [Pre‑submission checklist](#10-presubmission-checklist)

---

## 1. Предварительные требования

| Что          | Версия / комментарий                                      |
| ------------ | --------------------------------------------------------- |
| Node.js      | **22 LTS** (см. `.nvmrc`; `engines` в `package.json`)     |
| npm          | поставляется с Node                                       |
| Google Chrome| 102 или новее (нужен полноценный MV3)                     |
| Аккаунты     | владелец Google Cloud project + аккаунт CWS Developer ($5)|

CWS Developer разовая регистрационная плата — `$5` за весь аккаунт, не за
расширение. Делается один раз тут:
<https://chrome.google.com/webstore/devconsole>.

---

## 2. Настройка Google Cloud Console (один раз)

Текущий проект Google Cloud — `384905528545` (виден из `oauth2.client_id`).
Перед локальной отладкой и тем более перед публикацией нужно проверить
несколько вещей.

### 2.1. APIs

Откройте <https://console.cloud.google.com/apis/library>, выберите проект и
включите:

- **Google Drive API** — обязательно.
- **Google Picker API** — нужна для кнопок **Pick existing…** (Settings) и
  **Pick** (popup). Picker UI загружается со страницы GitHub Pages (см.
  раздел 2.5), не из zip расширения.

### 2.5. GitHub Pages — hosted Picker

Google Picker нельзя встроить в MV3 extension page (CSP запрещает
`apis.google.com`) и нельзя в sandbox (Chrome не разрешает
`allow-same-origin`). Решение — статическая страница в этом репозитории:

| Файл | Назначение |
| ---- | ---------- |
| `picker/index.html` | UI + diagnostic log |
| `picker/picker.js` | gapi + Picker + `chrome.runtime.sendMessage` |
| `_config.yml` | Jekyll exclude `src/`, include `picker/` |

**URL после deploy:**  
`https://nick-sorogovets.github.io/snow_time_extension/picker/`

**Включить Pages:** GitHub → repo → Settings → Pages → Source:
`master` / root → Save. После push в `master` подождите ~1 минуту.

**Связь с расширением:** в `src/manifest.json`:

```json
"externally_connectable": {
  "matches": ["https://nick-sorogovets.github.io/snow_time_extension/*"]
}
```

Picker запрашивает OAuth-токен через `chrome.runtime.sendMessage(extId,
{type:'request-token'})` — токен **не** передаётся в URL. Background
проверяет `sender.url` и принимает сообщения только с github.io origin.

**Extension ID для picker:** по умолчанию `cmhmigmpifnomnelnecfimefophfgldh`
(из поля `key` в манифесте). Override: `?ext=<id>` в URL picker-страницы.

### 2.2. OAuth consent screen

<https://console.cloud.google.com/apis/credentials/consent>

- **Scopes:** должен присутствовать **только**
  `https://www.googleapis.com/auth/drive.file`. Старый scope
  `https://www.googleapis.com/auth/drive` нужно удалить — это restricted
  scope, требующий App Verification + Security Assessment.
- **Publishing status:**
  - `Testing` — пока расширение не опубликовано в CWS. До 100 тестовых
    пользователей; их email‑ы добавляются в `Test users`. Других
    пользователей Google вернёт `403 access_denied`.
  - `In production` — после успешной отправки в CWS и переключения статуса.
    Так как `drive.file` non‑sensitive, дополнительная верификация **не
    требуется**.
- **App information:** название, логотип (берём `src/img/icon_128.png`),
  ссылку на Privacy Policy (см. ниже).
- **Authorized domains:** обычно не нужно для chrome‑extension flow, но
  если просит — добавьте свой домен Privacy Policy.

### 2.3. OAuth Client ID(s)

<https://console.cloud.google.com/apis/credentials>

В этом проекте используются **два** OAuth client_id:

| Где                                   | client_id                                                      |
| ------------------------------------- | -------------------------------------------------------------- |
| `src/manifest.json` (dev)             | `384905528545-5nupa2vochv26iqtfiokpj2c3s3lvolc...`             |
| `.env → PROD_OAUTH_CLIENT_ID` | prod client id (см. `.env.example`; файл в `.gitignore`)     |

Каждый client_id типа **Chrome Extension** жёстко привязан к одному
`Application ID` (= Extension ID). Поэтому:

- **Dev client_id** должен быть привязан к Extension ID, который Chrome
  выдаст вашей `unpacked` сборке. Узнать его: см. п. 3.4.
- **Prod client_id** — к Extension ID, который CWS назначит расширению при
  первой публикации.

После публикации через CWS prod ID не меняется. До публикации удобно
сразу зафиксировать ID полем `key` (см. раздел 8) — тогда dev и prod ID
совпадут и можно будет обойтись одним client_id.

### 2.4. Privacy Policy URL

Для расширений, использующих `identity` + Drive API, CWS **обязательно**
требует ссылку на Privacy Policy. Минимальное содержимое:

- Какие данные собираются (OAuth token, имя/id выбранной папки, имя
  пользователя‑префикс) и где хранятся (`chrome.storage.sync`).
- Что данные **не** передаются никаким третьим сторонам.
- Контакт для запросов на удаление.

Положите её, например, на GitHub Pages и подставьте URL в форму CWS
listing и в OAuth consent screen.

---

## 3. Локальная отладка (load unpacked)

### 3.1. Установка зависимостей

```bash
nvm use   # или: nvm install  (читает .nvmrc → Node 22 LTS)
cp .env.example .env   # задайте PROD_OAUTH_CLIENT_ID для production-сборки
npm install
```

> Используйте `.nvmrc` и публичный npm registry (см. `.npmrc`). Старый
> `package-lock.json` с корпоративным Artifactory больше не нужен.

### 3.2. Сборка

Есть два равноправных способа загрузить расширение в Chrome.

**Вариант A — без сборки, прямо из `src/`** (быстрее всего во время
разработки, но **OAuth client_id будет dev**):

```bash
npm run i18n   # обязательно: генерирует src/js/i18n-data.js (gitignored)
# Load unpacked → ./src
```

> Без `npm run i18n` service worker упадёт — модуль `i18n.js` импортирует
> `i18n-data.js`, которого нет в git.

**Вариант B — production-сборка (Webpack, prod client_id):**

```bash
npm run build
# → i18n + webpack → ./build/
# → zip в ./dist/SNOW screenshot extension v0.1.0.zip
```

> **Важно:** Webpack читает `PROD_OAUTH_CLIENT_ID` из `.env` и подменяет в
> `build/manifest.json` `oauth2.client_id` на **prod** значение. Если будете
> загружать `build/` как unpacked для отладки, OAuth начнёт стучаться к
> prod client_id и упадёт с `bad client id` (т.к. Extension ID
> локального unpacked ≠ prod). Для локалки используйте `src/`.

### 3.3. Включить Developer Mode

1. Откройте `chrome://extensions`.
2. Включите тумблер **Developer mode** (правый верхний угол).
3. Нажмите **Load unpacked**.
4. Укажите папку `src/` (для отладки) или `build/` (для проверки прод‑сборки).

### 3.4. Узнать выданный Extension ID

После загрузки на карточке расширения отображается строка
`ID: <32 hex chars>`. Скопируйте её.

В Google Cloud Console → Credentials откройте dev client_id, поле
`Application ID` должно совпадать с этим ID. Если нет:

- либо обновите `Application ID` в существующем dev client_id,
- либо создайте новый client_id типа `Chrome Extension` и подставьте в
  `src/manifest.json`.

> Чтобы Extension ID не «плыл» между машинами, см. раздел 8 (поле `key`).

### 3.5. Авторизация

1. Кликните по иконке расширения → откроется popup.
2. Если в settings ещё ничего не настроено — popup покажет баннер
   `Configure the extension first`. Откройте Settings.
3. В Settings:
   - Введите `Username prefix`.
   - Нажмите **Create folder** → имя → OAuth → новая папка в корне Drive.
   - Альтернатива: **Pick existing…** → новый таб GitHub Pages → Google
     Picker → выбор существующей папки (даёт `drive.file` доступ).
   - **Save & close**.

Если на этапе OAuth Chrome показывает «This app isn't verified» — значит
в Cloud Console остался restricted scope `drive`. Удалите его, оставьте
только `drive.file` и попросите пользователя сбросить OAuth grants:
<https://myaccount.google.com/permissions>.

---

## 4. Smoke‑тесты после загрузки

Прогоните минимум этот сценарий, прежде чем заливать в CWS.

| # | Шаг                                                                | Ожидаемое                                                  |
| - | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1 | Установить unpacked, открыть popup до конфигурации                 | Баннер `Configure the extension first`, ссылка на Settings |
| 2 | В Settings — Create new → имя папки → Save                         | Папка создаётся, в Drive видна; `folder_id` сохранён        |
| 3 | В popup — Capture (visible mode)                                     | Превью текущей вкладки появляется                           |
| 3b| Settings → Screenshot mode = Full page → Capture длинной страницы   | Склеенный PNG всей загруженной высоты                       |
| 3c| Settings → Language = Русский → popup/options                       | UI на выбранном языке                                       |
| 4 | В popup — Upload                                                   | Файл `<username>_YYYY-MM-DD.png` появляется в Drive‑папке   |
| 5 | В popup — Browse → клик по подпапке                                | Список подпапок, breadcrumb обновляется                     |
| 6 | В Settings — Pick existing → выбрать папку в Picker               | Новый таб github.io/picker/, выбор сохраняется в Settings    |
| 6b| В popup — Pick → выбрать папку → снова открыть popup               | Breadcrumb указывает на выбранную папку (TTL 5 мин)         |
| 7 | Зайти на `https://coxauto.service-now.com/time*`                   | Кнопка SNOW Submit меняется на `Submit & Upload` (если включён auto_upload) |
| 8 | Открыть DevTools → Service Worker (chrome://extensions → Inspect)  | В консоли service worker нет ошибок                         |
| 9 | DevTools popup → Console                                           | Нет CSP‑warnings, нет 4xx/5xx из Google API                 |

В любой момент можно посмотреть текущие permissions расширения в
`chrome://extensions/?id=<id>` → `Site access`.

---

## 5. Подготовка прод‑сборки

1. **Поднять версию** в **обоих** местах одинаково:

   ```jsonc
   // src/manifest.json
   "version": "0.0.10"
   ```

   ```jsonc
   // package.json
   "version": "0.0.10"
   ```

   CWS отклоняет zip, у которого `version` не больше предыдущей
   опубликованной.

2. **Pull‑request‑чек:**
   - В `src/manifest.json` нет лишних `permissions` / `host_permissions`.
   - `oauth2.scopes` содержит только `drive.file`.
   - Нет `console.log` с чувствительными данными (токены).
   - `Phase 1–5` чек‑лист из `PLAN.md` всё ещё ✅.

3. **Чистая сборка:**

   ```bash
   rm -rf build dist
   npm run build
   ```

   Результат: `dist/SNOW screenshot extension v0.0.10.zip`.

4. **Sanity‑check zip‑а локально:**

   ```bash
   mkdir -p /tmp/snow-check && unzip -d /tmp/snow-check "dist/SNOW screenshot extension v0.0.10.zip"
   ```

   В Chrome: `Load unpacked → /tmp/snow-check`. Проверьте, что unpacked
   prod‑сборка стартует с **prod client_id** (см. 3.2 — она будет требовать
   prod Extension ID, поэтому корректно проверится только если у вас
   уже зафиксирован `key`, см. раздел 8).

5. **Размер.** Текущая прод‑сборка — около 35–40 KB zip. Если вдруг
   выросло >150 KB — что‑то лишнее попало в `build/`.

---

## 6. Публикация в Chrome Web Store

### 6.1. Первый раз

1. Зайдите в <https://chrome.google.com/webstore/devconsole>.
2. **New item** → залейте `dist/SNOW screenshot extension v0.0.10.zip`.
3. CWS назначит **Item ID** = Extension ID. Скопируйте.
4. Перейдите в Cloud Console → Credentials → создайте OAuth Client
   типа `Chrome Extension` с этим Item ID. Подставьте полученный
   `client_id` в `.env` (`PROD_OAUTH_CLIENT_ID`). Пересоберите и
   перезалейте zip (см. 5).

### 6.2. Заполнить Store listing

| Поле                  | Значение                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Name                  | SNOW Screenshot Extension                                                                                 |
| Summary (≤132 chars)  | Capture the current tab and upload it straight to your Google Drive folder.                                |
| Description           | Развернуто: что делает, для каких сайтов, что хранится локально, что не передаётся third parties.         |
| Category              | Productivity                                                                                              |
| Language              | English (можно добавить Russian)                                                                          |
| Screenshots (1280×800)| 1–5 шт. Сделайте через сам popup на демо‑странице. Положите в `img/store/` (НЕ копируем в zip).            |
| Promotional images    | Опционально, 440×280                                                                                      |
| Icon                  | `src/img/icon_128.png`                                                                                    |
| Privacy Policy URL    | См. 2.4                                                                                                   |
| Single purpose        | "Take a screenshot of the current tab and upload it to a Google Drive folder of the user's choice."        |

### 6.3. Permissions justifications

CWS попросит обосновать каждое разрешение. Шаблонные ответы:

| Permission                                  | Justification                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `storage`                                   | Save user settings (Drive folder id, username prefix, automation toggles).                          |
| `identity`                                  | Obtain an OAuth token for Google Drive uploads through `chrome.identity.getAuthToken`.              |
| `activeTab`                                 | Capture the visible area of the current tab via `chrome.tabs.captureVisibleTab` after a user click. |
| `notifications`                             | Notify the user when a screenshot upload succeeds or fails in the background.                       |
| host `https://coxauto.service-now.com/time*`| Detect the SNOW Submit button and bind the auto‑upload listener on the time‑sheet page.             |

### 6.4. OAuth scope justification

| Scope                                                | Justification                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `https://www.googleapis.com/auth/drive.file`         | Create a screenshots root folder, list its sub‑folders, and upload PNGs.   |

### 6.5. Submit for review

1. Сохраните draft.
2. Нажмите **Submit for Review**.
3. Времена ревью CWS:
   - простое расширение без sensitive scopes — обычно 1–3 дня;
   - первая submission — может быть до 7 дней;
   - доп. ревью при появлении host_permissions — пара дней.
4. После approve переключите OAuth consent screen в `In production`.

---

## 7. Обновление уже опубликованной версии

1. `Phase`‑изменения → коммит → bump `version` (см. 5.1).
2. `npm run build`.
3. CWS Devconsole → выбрать item → **Package** → Upload new package →
   тот же zip из `dist/`.
4. **Privacy practices** перепроверить (если поменяли permissions).
5. **Submit for review**.

`onInstalled.reason === 'update'` уже обрабатывается в
`background.js` — старый `folder_url` пользователя удаляется, и
открывается options page с просьбой пере‑настроить (это сделано из‑за
смены OAuth scope с `drive` на `drive.file`).

---

## 7.5. Автопубликация через GitHub Actions

Workflow [`.github/workflows/release.yml`](.github/workflows/release.yml)
автоматически собирает zip, загружает его в Chrome Web Store и создаёт
GitHub Release при merge в `master`, **если** в том же коммите изменилась
`version` в `src/manifest.json`.

### Когда срабатывает

| Событие | Поведение |
| ------- | --------- |
| Push в `master`, `version` выросла | Build → CWS upload + publish → tag `v<version>` → GitHub Release с zip |
| Push в `master`, `version` не менялась | Workflow завершается без публикации |
| Manual **Run workflow** + `force_version: true` | Публикует текущую `version` без проверки diff (escape hatch) |

CI также проверяет, что `src/manifest.json` и `package.json` содержат
одинаковую `version` (см. §5.1).

### Локализация listing summary

Сборка генерирует Chrome-standard `_locales/<lang>/messages.json` из
`src/i18n/*.json` (ключи `extension_name`, `extension_description`).
В `manifest.json` используются `__MSG_name__` / `__MSG_description__` и
`default_locale: en`. CWS подхватывает эти строки при review нового
пакета — отдельный API для обновления listing description **не нужен**
(и официально недоступен в CWS API v2).

### Одноразовая настройка (оператор)

> **Важно:** первый item в CWS нужно создать вручную (§6.1). API может
> только обновлять существующий item.

#### 1. Включить Chrome Web Store API

1. Откройте [Google Cloud Console](https://console.cloud.google.com/).
2. Выберите проект (или создайте отдельный для CI).
3. Включите **Chrome Web Store API** в API Library.
4. Настройте **OAuth consent screen** (External, добавьте свой email в
   Test users).
5. Создайте **OAuth client ID** типа **Web application**:
   - Authorized redirect URI:
     `https://developers.google.com/oauthplayground`
6. Сохраните **Client ID** и **Client secret**.

#### 2. Получить refresh token

1. Откройте [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Settings (⚙) → **Use your own OAuth credentials** → вставьте Client ID
   и Client secret.
3. В **Input your own scopes** добавьте:
   `https://www.googleapis.com/auth/chromewebstore`
4. **Authorize APIs** → войдите аккаунтом **владельца** CWS item.
5. **Exchange authorization code for tokens** → скопируйте **Refresh token**.

> Если refresh token не появляется, повторите авторизацию с параметрами
> `access_type=offline` и `approval_prompt=force` (известный gotcha Google
> OAuth).

#### 3. GitHub secrets и environment

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Значение |
| ------ | -------- |
| `PROD_OAUTH_CLIENT_ID` | Prod OAuth client id расширения (из `.env`) |
| `CWS_EXTENSION_ID` | 32-символьный Extension ID из CWS Devconsole |
| `CWS_CLIENT_ID` | OAuth Client ID из шага 1 (Web application) |
| `CWS_CLIENT_SECRET` | OAuth Client secret |
| `CWS_REFRESH_TOKEN` | Refresh token из шага 2 |

Опционально: создайте environment **`chrome-web-store`** (Settings →
Environments) и включите **Required reviewers**, чтобы каждая публикация
требовала ручного approve.

### Как выпустить новую версию

1. Поднимите `version` **одинаково** в `src/manifest.json` и `package.json`.
2. Обновите переводы `extension_name` / `extension_description` в
   `src/i18n/*.json` при необходимости.
3. Merge PR в `master`.
4. Дождитесь green workflow **Release** в Actions.
5. Проверьте CWS Devconsole → item → статус review (обычно 1–3 дня).

### Откат / отмена

- **GitHub:** удалите tag/release `v<version>` если нужно (не откатывает CWS).
- **CWS:** Devconsole → **Cancel submission** или через API
  `cancelSubmission` (см. [CWS API docs](https://developer.chrome.com/docs/webstore/using-api)).
- Повторная публикация той же `version` будет отклонена — bump версии
  обязателен.

---

## 8. Привязка стабильного Extension ID (поле `key`)

Чтобы Extension ID не менялся между unpacked и CWS установками:

1. Один раз заберите `key` из CWS:
   - Залейте zip в Devconsole, дойдите до Item details.
   - В **Package → Upload package** есть кнопка **Download package**.
     Распакуйте — внутри будет `manifest.json` с уже подставленным CWS
     полем `"key": "<base64‑public‑key>"`.
2. Скопируйте это значение в **исходный** `src/manifest.json`:

   ```jsonc
   {
     "manifest_version": 3,
     "name": "SNOW screenshot extension",
     "key": "MIIBIjANBgkqhkiG9w0BAQEFAA…",
     // …
   }
   ```

3. Пересоберите. Теперь:
   - Unpacked Extension ID = CWS Extension ID.
   - Достаточно одного OAuth client_id в Cloud Console.
   - Можно убрать подмену `client_id` в `webpack.config.js` (см. ниже).

> Поле `key` безопасно публиковать в репозитории — это **публичный**
> ключ, не секрет. Парный приватный ключ Google хранит у себя.

После добавления `key` упростите transform для `manifest.json` в
`webpack.config.js` — копируйте файл без подмены `client_id`.

---

## 9. Troubleshooting

### Popup: «Configure the extension first» (локально)

Это **не** ошибка Google OAuth. Popup показывает её, пока в Settings не
заданы:

- папка Drive (`folder_id`) — через **Create folder** или **Pick existing…**
- префикс имени файла (`username`) — если не включён «Use site domain»

Откройте **Settings**, заполните поля, нажмите **Save & close**. После
этого popup попробует silent OAuth и покажет **Sign in to Drive**, если
токена ещё нет.

### Picker: «Could not establish connection. Receiving end does not exist.»

Это **не** ошибка OAuth на picker-странице. Picker на GitHub Pages шлёт
`chrome.runtime.sendMessage(extId, …)` в **background** расширения.
Chrome отвечает «Receiving end does not exist», если:

1. **Неверный Extension ID** — в URL picker нет `?ext=` или ID не совпадает с
   установленным расширением (часто при unpacked без `key` в manifest).
2. **Расширение выключено** или установлена другая копия (CWS vs unpacked).
3. **Background service worker не стартовал** — перезагрузите расширение на
   `chrome://extensions` и откройте picker снова через **Pick existing…**.

**Правильный порядок:**

1. `chrome://extensions` → включите Snow Screenshot → скопируйте **ID**.
2. Settings → **Pick existing…** (URL должен содержать `?ext=<ваш ID>`).
3. Не открывайте picker вручную без `ext` — hosted `picker.js` больше не
   подставляет ID по умолчанию.

**Стабильный ID (рекомендуется):** добавьте `key` в prod-сборку (Deploy.md §8).
Webpack подставляет его из `.keys/manifest-key.txt` или `MANIFEST_KEY` в `.env`.
Тогда unpacked и CWS имеют один ID (`cmhmigmpifnomnelnecfimefophfgldh` для
опубликованного item).

### CWS: «В загруженном пакете отсутствует файл значка ./img/icon_*.png»

Chrome Web Store **не понимает** пути с префиксом `./` в `manifest.json`.
Unpacked load в Chrome работает, но CWS ищет буквальный путь `./img/icon_16.png`
в zip, тогда как файл лежит как `img/icon_16.png`.

**Исправление:** в `src/manifest.json` используйте пути без `./`:

```jsonc
"icons": {
  "16": "img/icon_16.png",
  "48": "img/icon_48.png",
  "128": "img/icon_128.png"
}
```

Пересоберите (`npm run build`) и заливайте zip из `dist/`, не папку `src/`.

### Popup/Settings без стилей (белый фон, «сырой» HTML)

Сборка **до исправления v0.1.1** минифицировала `popup.css` / `options.css` через
CleanCSS и **удаляла** `@import './_tokens.css'` без подстановки токенов (`:root`,
`.hidden`, кнопки). В zip CSS-файлы были, но без переменных и utility-классов — UI
выглядел сломанным, часть JS-логики (скрытие блоков) тоже не работала.

**Исправление:** webpack объединяет `_tokens.css` в каждый page stylesheet перед
minify. `scripts/zip-dist.js` проверяет наличие `:root` в собранных CSS.

Пересоберите (`npm run build`), установите **распакованное содержимое** zip
(корень с `manifest.json`), не каталог `src/`.

`scripts/zip-dist.js` проверяет, что все icon-пути из **собранного**
`build/manifest.json` реально существуют перед упаковкой.

### CWS: «Значение в поле "key" манифеста не соответствует текущему продукту»

Вы обновляете **существующий** item в Devconsole, но `key` в zip не совпадает
с ключом, под которым item был создан.

**Синхронизация key (один раз):**

1. CWS Devconsole → ваш item → **Package** → **Download package**.
2. Распакуйте скачанный zip → откройте `manifest.json`.
3. Если там есть `"key": "…"` — скопируйте значение в `src/manifest.json`.
4. Если поля `key` **нет** — **удалите** `"key"` из `src/manifest.json`
   (item был создан без фиксированного ID).
5. Пересоберите и перезалейте.

Extension ID в Devconsole должен совпадать с ID вашего item. Текущий `key` в
репозитории соответствует ID `cmhmigmpifnomnelnecfimefophfgldh` — если в
Devconsole другой ID, key нужно заменить (шаги выше), а prod OAuth client_id
в Cloud Console привязать к **фактическому** Extension ID item'а.

### `OAuth2: bad client id: <id>`

Extension ID не совпадает с `Application ID` у OAuth client_id в Cloud
Console. Проверьте п. 3.4 или зафиксируйте `key` (раздел 8).

### `OAuth2: access_denied` / «App isn't verified»

- Pubilshing status = `Testing`, а тестируете чужим email.
- Или в OAuth consent screen остался старый restricted scope `drive`.
  Удалить, оставить только `drive.file`.
- Сбросить уже выданный grant: <https://myaccount.google.com/permissions>.

### Picker tab пустой / «Chrome extension APIs unavailable»

- GitHub Pages не задеплоены — проверьте
  `https://nick-sorogovets.github.io/snow_time_extension/picker/` в браузере.
- Расширение не установлено или `externally_connectable` не совпадает с URL.
- Picker API не включён в Cloud Console.
- OAuth `Application ID` ≠ Extension ID (см. раздел 8).

### `Refused to load script https://apis.google.com/js/api.js` в popup/options

Picker загружается **только** с GitHub Pages (`picker/index.html`), не из
extension pages. Если эта ошибка в popup/options — где‑то остался прямой
`<script src="https://apis.google.com/...">` в `src/*.html`.

### Picker открывается, но Drive не показывает папок

`drive.file` показывает только то, что создал/выбрал ваш app. Если
хотите видеть _свои_ существующие папки — выбирайте их через Picker
один раз; после этого они станут видимы и `GetSubFolderList`.

### `Service worker registration failed` (status code 15)

Частые причины:

1. **Синтаксическая ошибка в JS** — откройте карточку Errors. Типично:
   `i18n-data.js` не сгенерирован → выполните `npm run i18n` и перезагрузите
   расширение. Если в переводах апострофы — пересоберите i18n (скрипт
   использует `JSON.stringify`, не одинарные кавычки).
2. **`background.js` использует `window`/`document`** — недопустимо в SW.
3. **`manifest.json` → `"type": "module"`** для service worker.

### `chrome.tabs.captureVisibleTab` возвращает пустую картинку

Случается на страницах вне `host_permissions` если popup не открыт от
действия пользователя. Убедитесь, что capture вызывается из
popup‑контекста (где `activeTab` уже выдан) или с SNOW‑домена,
указанного в `host_permissions`.

### Расширение исчезло после обновления

Chrome удаляет MV3 расширение, у которого манифест не валидный.
Перезагрузите unpacked сборку и посмотрите красную плашку «Errors»
на карточке расширения в `chrome://extensions`.

---

## 10. Pre‑submission checklist

- [ ] `src/manifest.json` → `version` поднят, синхронизирован с `package.json`.
- [ ] `oauth2.scopes` содержит только `drive.file`.
- [ ] `permissions` минимальный (storage, identity, activeTab, notifications, **scripting**).
- [ ] `host_permissions` ограничен SNOW‑доменом.
- [ ] `content_security_policy.extension_pages` без внешних доменов.
- [ ] `externally_connectable` указывает на github.io picker URL.
- [ ] GitHub Pages задеплоены (`picker/` доступен по HTTPS).
- [ ] Picker API enabled в Cloud Console.
- [ ] OAuth consent screen в Cloud Console: scope = `drive.file`, статус правильный.
- [ ] Privacy Policy опубликован, URL добавлен в CWS listing и Cloud Console.
- [ ] `npm run build` проходит без ошибок, размер zip ≤ ~100 KB.
- [ ] Smoke‑тесты раздела 4 пройдены на чистом профиле Chrome.
- [ ] (Опц.) `key` в манифесте зафиксирован (раздел 8).
- [ ] Скриншоты (1280×800) подготовлены.

После всех галочек — `Submit for review` в Devconsole.

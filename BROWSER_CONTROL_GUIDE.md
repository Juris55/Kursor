# Pārlūka vadīšana / Browser Control / Управление браузером

---

## LV: Pārlūka vadīšana

### Pārskats

Kursor teksta redaktorā ir iebūvēta MI vadīta pārlūka kontrole, kas ļauj MI aģentam automātiski veikt darbības tīmekļa lapās:

- **Klikšķināšana** uz elementiem (pēc CSS selektora vai koordinātām)
- **Ritināšana** pa lapu (uz augšu/leju/kreis/pa labi)
- **Rakstīšana** teksta ievades laukos (pa burtam ar aizkavi)
- **Navigācija** uz citiem URL

Visas darbības tiek attēlotas ar vizuālu pārklājumu, kas rāda reāllaika progresu.

### Kā tas darbojas

1. Lietotājs dod MI uzdevumu (piem., "Atver Google un sameklē jaunākās ziņas")
2. MI izmanto pārlūka kontroli, lai veiktu darbības
3. Ekrānā parādās pārklājums ar progresa indikatoru
4. Pēc darbībām MI atgriež rezultātu čatā

### Atļauju sistēma

Pirms pārlūka testēšanas MI pieprasa atļauju. Lietotājs redz dialoga logu:

- **Atļaut** — MI veic darbību, uzņem ekrānuzņēmumu un atgriež lapas info
- **Atteikt** — darbība netiek veikta

Pēc atļaušanas automātiski tiek izsaukts auto-respond, lai MI analizētu rezultātu.

### Pārlūka atbalsts pa platformām

| Pārlūks | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |
| Opera | ✅ | ✅ | ✅ |
| Safari | ❌ | ✅ | ❌ |

Noklusējuma pārlūks tiek izmantots, ja izvēlētais nav atrasts.

### Pārlūka kontroles serviss

Fails: `src/services/browserControl.ts`

#### Sesijas

```typescript
createSession(): BrowserSession
startSession(sessionId?: string): BrowserSession
closeSession(sessionId?: string): void
```

#### Darbības

```typescript
click(options: ClickOptions): Promise<void>
scroll(options: ScrollOptions): Promise<void>
type(options: TypeOptions): Promise<void>
navigate(options: NavigateOptions): Promise<void>
executeActions(actions: BrowserAction[], sessionId?: string): Promise<void>
```

#### Monitorings

```typescript
onProgress(callback: (progress: BrowserProgress) => void): () => void
getStatus(sessionId?: string): BrowserProgress
getPageInfo(sessionId?: string): PageInfo
takeScreenshot(sessionId?: string): Promise<string | null>
```

### Progresa pārklājums

Komponente `src/components/BrowserControl.tsx` attēlo:

- Statusa ikonu (idle, executing, completed, error)
- Pašreizējās darbības aprakstu
- Progresa joslu ar procentiem
- Izpildīto/kopējo darbību skaitu
- Pogu "Apturēt izpildi"

### Integrācija ar MI čatu

MI čatā (`AIChat.tsx`) tiek atpazīti `[[ACTION:test-browser:...]]` tagi, kas izsauc atļauju dialogu un pārlūka testu.

### Iestatījumi

Iestatījumos var izvēlēties pārlūku testēšanai:
**Iestatījumi → Pārlūks testēšanai → Chrome/Firefox/Edge/Opera/Safari**

### Tulkojumi

Pārlūka kontrole ir pilnībā tulkota:
- **Latviešu** (`lv.json` — sadaļa `"browser"`)
- **Angļu** (`en.json` — sadaļa `"browser"`)
- **Krievu** (`ru.json` — sadaļa `"browser"`)

### Problēmu risināšana

**Darbības neizpildās** — pārbaudi vai sesija ir startēta un CSS selektors ir pareizs
**Progres nav redzams** — pārbaudi vai `onProgress` callback ir pieslēgts
**Navigācija bloķēta** — CORS ierobežojumi; izmanto MI, lai atvērtu URL jaunā cilnē

---

## EN: Browser Control

### Overview

Kursor includes an AI-powered Browser Control feature that allows the AI agent to automatically interact with web pages:

- **Clicking** elements (by CSS selector or coordinates)
- **Scrolling** the page (up/down/left/right)
- **Typing** text into input fields (character by character with delay)
- **Navigating** to URLs

All actions are shown in a visual overlay with real-time progress updates.

### How it works

1. User gives the AI a task (e.g., "Open Google and search for latest news")
2. AI uses browser control to perform actions
3. An overlay with progress indicator appears on screen
4. After actions, AI returns results in the chat

### Permission system

Before browser testing, the AI requests permission. The user sees a dialog:

- **Allow** — AI performs the action, takes a screenshot, returns page info
- **Deny** — action is not performed

After allowing, auto-respond triggers so AI can analyze the result.

### Browser support by platform

| Browser | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |
| Opera | ✅ | ✅ | ✅ |
| Safari | ❌ | ✅ | ❌ |

The default browser is used if the selected one is not found.

### Browser control service

File: `src/services/browserControl.ts`

#### Sessions

```typescript
createSession(): BrowserSession
startSession(sessionId?: string): BrowserSession
closeSession(sessionId?: string): void
```

#### Actions

```typescript
click(options: ClickOptions): Promise<void>
scroll(options: ScrollOptions): Promise<void>
type(options: TypeOptions): Promise<void>
navigate(options: NavigateOptions): Promise<void>
executeActions(actions: BrowserAction[], sessionId?: string): Promise<void>
```

#### Monitoring

```typescript
onProgress(callback: (progress: BrowserProgress) => void): () => void
getStatus(sessionId?: string): BrowserProgress
getPageInfo(sessionId?: string): PageInfo
takeScreenshot(sessionId?: string): Promise<string | null>
```

### Progress overlay

The `src/components/BrowserControl.tsx` component displays:

- Status icon (idle, executing, completed, error)
- Current action description
- Progress bar with percentage
- Completed/total action count
- "Stop Execution" button

### Integration with AI chat

The AI chat (`AIChat.tsx`) recognizes `[[ACTION:test-browser:...]]` tags, triggering the permission dialog and browser test.

### Settings

Settings allow choosing a browser for testing:
**Settings → Test browser → Chrome/Firefox/Edge/Opera/Safari**

### Translations

Browser control is fully translated into:
- **English** (`en.json` — section `"browser"`)
- **Latvian** (`lv.json` — section `"browser"`)
- **Russian** (`ru.json` — section `"browser"`)

### Troubleshooting

**Actions not executing** — check that session is started and CSS selector is valid
**Progress not updating** — check that `onProgress` callback is subscribed
**Navigation blocked** — CORS limitations; use AI to open URL in a new tab

---

## RU: Управление браузером

### Обзор

Kursor включает функцию управления браузером на основе ИИ, которая позволяет агенту ИИ автоматически взаимодействовать с веб-страницами:

- **Нажатие** на элементы (по CSS-селектору или координатам)
- **Прокрутка** страницы (вверх/вниз/влево/вправо)
- **Печать** текста в поля ввода (по символам с задержкой)
- **Навигация** по URL-адресам

Все действия отображаются в визуальном оверлее с индикатором прогресса в реальном времени.

### Как это работает

1. Пользователь даёт задание ИИ (например, "Открой Google и найди последние новости")
2. ИИ использует управление браузером для выполнения действий
3. На экране появляется оверлей с индикатором прогресса
4. После действий ИИ возвращает результат в чат

### Система разрешений

Перед тестированием браузера ИИ запрашивает разрешение. Пользователь видит диалог:

- **Разрешить** — ИИ выполняет действие, делает скриншот, возвращает информацию о странице
- **Запретить** — действие не выполняется

После разрешения срабатывает автоответ, чтобы ИИ проанализировал результат.

### Поддержка браузеров по платформам

| Браузер | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |
| Opera | ✅ | ✅ | ✅ |
| Safari | ❌ | ✅ | ❌ |

Браузер по умолчанию используется, если выбранный не найден.

### Сервис управления браузером

Файл: `src/services/browserControl.ts`

#### Сессии

```typescript
createSession(): BrowserSession
startSession(sessionId?: string): BrowserSession
closeSession(sessionId?: string): void
```

#### Действия

```typescript
click(options: ClickOptions): Promise<void>
scroll(options: ScrollOptions): Promise<void>
type(options: TypeOptions): Promise<void>
navigate(options: NavigateOptions): Promise<void>
executeActions(actions: BrowserAction[], sessionId?: string): Promise<void>
```

#### Мониторинг

```typescript
onProgress(callback: (progress: BrowserProgress) => void): () => void
getStatus(sessionId?: string): BrowserProgress
getPageInfo(sessionId?: string): PageInfo
takeScreenshot(sessionId?: string): Promise<string | null>
```

### Оверлей прогресса

Компонент `src/components/BrowserControl.tsx` отображает:

- Иконку статуса (idle, executing, completed, error)
- Описание текущего действия
- Индикатор прогресса с процентами
- Количество выполненных/всего действий
- Кнопку "Остановить выполнение"

### Интеграция с ИИ-чатом

Чат ИИ (`AIChat.tsx`) распознаёт теги `[[ACTION:test-browser:...]]`, вызывая диалог разрешений и тест браузера.

### Настройки

В настройках можно выбрать браузер для тестирования:
**Настройки → Браузер для тестирования → Chrome/Firefox/Edge/Opera/Safari**

### Переводы

Управление браузером полностью переведено на:
- **Английский** (`en.json` — раздел `"browser"`)
- **Латышский** (`lv.json` — раздел `"browser"`)
- **Русский** (`ru.json` — раздел `"browser"`)

### Решение проблем

**Действия не выполняются** — проверьте, что сессия запущена и CSS-селектор корректен
**Прогресс не обновляется** — проверьте, что `onProgress` callback подписан
**Навигация заблокирована** — ограничения CORS; используйте ИИ для открытия URL в новой вкладке

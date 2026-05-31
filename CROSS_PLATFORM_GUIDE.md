# Kursor — pilnīga pamācība / Complete Guide / Полное руководство

---

## LV: Kursor teksta redaktora iespējas un palaišana

### Kas ir Kursor?

Kursor ir profesionāls teksta redaktors ar mākslīgā intelekta atbalstu, kas darbojas uz Windows, macOS un Linux. Tajā ir iekļauts Monaco redaktors (tas pats, kas VS Code), iebūvēts terminālis, MI čats, pārlūka kontrole un HTML dizaina ģenerators.

### Sistēmas prasības

| Platforma | Prasības |
|-----------|----------|
| **Windows** | Windows 10+, 200 MB brīvas vietas |
| **macOS** | macOS 11 (Big Sur)+, Intel vai Apple Silicon |
| **Linux** | Ubuntu 20.04+, Debian 11+, Fedora 36+; GTK3; 200 MB |

### Uzstādīšana un palaišana

```bash
git clone https://github.com/daimo/kursor.git
cd kursor
npm install
npm run electron:dev      # izstrādes režīms ar karsto pārlādi
```

### Buildošana izplatīšanai (Windows)

```bash
# Windows — visas arhitektūras
npm run electron:build:win           # x64 (Intel/AMD)
npm run electron:build:win:arm       # ARM64 (Snapdragon, Surface Pro X)
npm run electron:build:win:x86       # x86 (32-bit)
npm run electron:build:win:all       # x64 + arm64 + x86 vienā piegājienā

# macOS un Linux — jābūvē uz attiecīgās OS
npm run electron:build:mac           # macOS Intel (.dmg, .zip)
npm run electron:build:mac:arm       # macOS Apple Silicon
npm run electron:build:mac:all       # Intel + Apple Silicon
npm run electron:build:linux         # Linux x64 (.AppImage, .deb)
npm run electron:build:linux:arm     # Linux ARM64
npm run electron:build:linux:x86     # Linux x86
npm run electron:build:linux:all     # x64 + arm64 + x86
```

**Rezultāts — mapē `release/`:**

| Fails | Arhitektūra |
|-------|------------|
| `Kursor-Setup-2.0.0-x64.exe` | x64 (Intel/AMD) |
| `Kursor-Setup-2.0.0-arm64.exe` | ARM64 |
| `Kursor-Setup-2.0.0-ia32.exe` | x86 (32-bit) |
| `Kursor-Setup-2.0.0.exe` | Kombinētais (visas 3) |

**Lai izveidotu build visām platformām (Windows + macOS + Linux + visām arhitektūrām), vajag CI/CD, piem., GitHub Actions — katru OS būvē uz savas platformas. No Windows var uzbūvēt tikai Windows versijas.**

---
### Izstrādes režīms (ar karsto pārlādi)

```bash
npm run electron:dev
```

### Visas redaktora iespējas

#### Failu pārvaldība
- Atvērt/saglabāt failus (`Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S`)
- Atvērt mapes (`Ctrl+K`), pārlūkot failu koku
- Vairākas darbvirsmas mapes (workspace folders)
- Jauna faila/ mapes izveide, pārsaukšana, dzēšana (ar konteksta izvēlni)
- Meklēšana failos (case-insensitive, rekurzīva)
- Nesen atvērtie faili

#### Redaktors (Monaco)
- Vairāku cilņu atvēršana
- Valodas noteikšana pēc paplašinājuma (50+ valodu)
- Vārdu ietīšana (word wrap)
- Minikarte (minimap)
- Rindu numuri
- Fonta izmēra maiņa
- Tumšais/gaišais režīms
- Vienkāršais režīms (textarea), ja Monaco neielādējas

#### Problēmu panelis
- Monaco diagnostikas marķieri (kļūdas, brīdinājumi)
- Kārtošana pēc faila, rindas, kolonnas

#### Iebūvētais priekšskatījums
- HTML/SVG/XML failu priekšskatīšana iframe
- Poga atvērt pārlūkā
- Konsoles izvades logs (no iframe)

#### Iebūvētā konsole
- Notver console.log/warn/error no priekšskatījuma
- Notīrīšanas poga

#### Terminālis
- Windows: PowerShell vai Command Prompt
- macOS: Zsh (noklusējuma) vai Bash
- Linux: Bash (noklusējuma) vai Zsh
- Automātiska `cd` uz atvērto mapi
- Izmēra regulēšana (velkot)

#### MI čats
- Čata režīmi: Chat, Think, Code, Plan
- Dziļuma izvēle: Maximum, High, Medium, Low
- 50+ MI provideru preseti (OpenAI, Anthropic, Groq, DeepSeek, lokālie u.c.)
- Streaming atbildes
- Pielikumi: faili, attēli (base64), mapes, video
- Pielāgotie promti (custom prompts)
- MCP serveru pārvaldība
- Proxy/VPN atbalsts (HTTP/HTTPS/SOCKS)
- Automātiska koda bloku saglabāšana
- Automātiska atbildēšana (auto-respond)

#### Pārlūka kontrole
- Automātiska klikšķināšana, ritināšana, rakstīšana, navigācija
- Progresa pārklājums ar indikatoru
- Ekrānuzņēmumu uzņemšana
- Lapas informācijas iegūšana

#### Dizaina ģenerators
- HTML vietņu ģenerēšana ar MI
- Sekciju izvēle (Hero, Features, Pricing, FAQ, u.c.)
- 5 stili, 9 krāsu shēmas
- Atsauces vietņu URL un apraksta ievade
- Priekšskatīšana, kopēšana, saglabāšana

#### AI diagnostika
- Aktīvā faila analīze ar MI
- Rezultātu parādīšana kā Monaco marķieri

#### Atļauju sistēma
- MI pieprasa atļauju pirms darbības (atvērt URL, rakstīt failu, dzēst, testēt pārlūku, lasīt, izpildīt komandu)
- Atļauju vēsture

#### Izkārtojums
- Sānjoslas platuma regulēšana (velkot)
- AI paneļa platuma regulēšana
- Termināļa augstuma regulēšana
- Rādīt/paslēpt sānjoslu, termināli, AI paneli (`Ctrl+\``, `Ctrl+I`)
- Izkārtojuma atiestatīšana

#### Īsinājumtaustiņi

| Taustiņš | Darbība |
|----------|---------|
| `Ctrl+N` | Jauns fails |
| `Ctrl+O` | Atvērt failu |
| `Ctrl+K` | Atvērt mapi |
| `Ctrl+S` | Saglabāt |
| `Ctrl+Shift+S` | Saglabāt kā |
| `Ctrl+Z` | Atsaukt |
| `Ctrl+Shift+Z` | Atcelt atsaukšanu |
| `Ctrl+X` | Izgriezt |
| `Ctrl+C` | Kopēt |
| `Ctrl+V` | Ielīmēt |
| `Ctrl+A` | Izvēlēties visu |
| `Ctrl+\`` | Rādīt/paslēpt termināli |
| `Ctrl+I` | Rādīt/paslēpt AI paneli |

### Iestatījumi

**Vispārīgie**: tēma (tumšā/gaišā), valoda (LV/EN/RU), fonta izmērs
**Redaktors**: word wrap, minimap, rindu numuri, automātiska saglabāšana
**Terminālis**: noklusējā čaula (+atkarībā no platformas)
**Pārlūks testēšanai**: Chrome, Firefox, Edge, Opera, Safari (tikai macOS)
**Izkārtojums**: sānjoslas/AI paneļa/termināļa izmēri

---

## EN: Kursor text editor — complete guide and launch instructions

### What is Kursor?

Kursor is a professional text editor with AI support, running on Windows, macOS, and Linux. It includes the Monaco editor (same as VS Code), a built-in terminal, AI chat, browser control, and an HTML design generator.

### System requirements

| Platform | Requirements |
|-----------|----------|
| **Windows** | Windows 10+, 200 MB free space |
| **macOS** | macOS 11 (Big Sur)+, Intel or Apple Silicon |
| **Linux** | Ubuntu 20.04+, Debian 11+, Fedora 36+; GTK3; 200 MB |

### Installation and launch

```bash
git clone https://github.com/daimo/kursor.git
cd kursor
npm install
npm run electron:dev      # dev mode with hot reload
```

### Building for distribution (Windows)

```bash
# Windows — all architectures
npm run electron:build:win           # x64 (Intel/AMD)
npm run electron:build:win:arm       # ARM64 (Snapdragon, Surface Pro X)
npm run electron:build:win:x86       # x86 (32-bit)
npm run electron:build:win:all       # x64 + arm64 + x86 at once

# macOS and Linux — must build on target OS
npm run electron:build:mac           # macOS Intel (.dmg, .zip)
npm run electron:build:mac:arm       # macOS Apple Silicon
npm run electron:build:mac:all       # Intel + Apple Silicon
npm run electron:build:linux         # Linux x64 (.AppImage, .deb)
npm run electron:build:linux:arm     # Linux ARM64
npm run electron:build:linux:x86     # Linux x86
npm run electron:build:linux:all     # x64 + arm64 + x86
```

**Output — `release/` directory:**

| File | Architecture |
|------|-------------|
| `Kursor-Setup-2.0.0-x64.exe` | x64 (Intel/AMD) |
| `Kursor-Setup-2.0.0-arm64.exe` | ARM64 |
| `Kursor-Setup-2.0.0-ia32.exe` | x86 (32-bit) |
| `Kursor-Setup-2.0.0.exe` | Combined (all 3) |

**To build for all platforms (Windows + macOS + Linux + all architectures), you need CI/CD (e.g. GitHub Actions) — each OS must be built on its own platform. From Windows you can only build Windows versions.**

---
### Dev mode (with hot reload)

```bash
npm run electron:dev
```

### All editor features

#### File management
- Open/save files (`Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S`)
- Open folders (`Ctrl+K`), browse file tree
- Multiple workspace folders
- Create/rename/delete files and folders (context menu)
- Search in files (case-insensitive, recursive)
- Recent files

#### Editor (Monaco)
- Multi-tab editing
- Language detection (50+ languages)
- Word wrap, minimap, line numbers
- Font size adjustment
- Dark/light theme
- Simple mode (textarea fallback)

#### Problems panel
- Monaco diagnostics markers (errors, warnings)
- Sorted by file, line, column

#### Built-in preview
- HTML/SVG/XML preview in iframe
- Open in browser button
- Console output log (from iframe)

#### Built-in console
- Captures console.log/warn/error from preview
- Clear button

#### Terminal
- Windows: PowerShell or Command Prompt
- macOS: Zsh (default) or Bash
- Linux: Bash (default) or Zsh
- Auto `cd` to opened folder
- Resizable by dragging

#### AI chat
- Chat modes: Chat, Think, Code, Plan
- Thinking depth: Maximum, High, Medium, Low
- 50+ AI provider presets (OpenAI, Anthropic, Groq, DeepSeek, local, etc.)
- Streaming responses
- Attachments: files, images (base64), folders, videos
- Custom prompts
- MCP server management
- Proxy/VPN support (HTTP/HTTPS/SOCKS)
- Auto-save code blocks
- Auto-respond

#### Browser control
- Auto click, scroll, type, navigate
- Progress overlay with status indicator
- Screenshots
- Page info extraction

#### Design generator
- AI-powered HTML website generation
- Section selection (Hero, Features, Pricing, FAQ, etc.)
- 5 styles, 9 color schemes
- Reference URLs and description input
- Preview, copy, save

#### AI diagnostics
- Analyze active file with AI
- Results shown as Monaco markers

#### Permission system
- AI requests permission before actions (open URL, write file, delete, test browser, read, run command)
- Permission history

#### Layout
- Sidebar width adjustment (draggable)
- AI panel width adjustment
- Terminal height adjustment
- Show/hide sidebar, terminal, AI panel (`Ctrl+\``, `Ctrl+I`)
- Layout reset

#### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+N` | New file |
| `Ctrl+O` | Open file |
| `Ctrl+K` | Open folder |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+X` | Cut |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+A` | Select all |
| `Ctrl+\`` | Toggle terminal |
| `Ctrl+I` | Toggle AI panel |

### Settings

**General**: theme (dark/light), language (LV/EN/RU), font size
**Editor**: word wrap, minimap, line numbers, auto save
**Terminal**: default shell (platform-dependent)
**Test browser**: Chrome, Firefox, Edge, Opera, Safari (macOS only)
**Layout**: sidebar/AI panel/terminal sizes

### Known issues

#### macOS — first launch
If macOS blocks the app:
```bash
xattr -cr /Applications/Kursor.app
```

#### Linux — missing dependencies
```bash
# Ubuntu/Debian
sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libatspi2.0-0
# Fedora
sudo dnf install gtk3 libnotify nss libXScrnSaver at-spi2-core
```

---

## RU: Kursor — полное руководство и запуск

### Что такое Kursor?

Kursor — профессиональный текстовый редактор с поддержкой ИИ, работающий на Windows, macOS и Linux. Включает редактор Monaco (как в VS Code), встроенный терминал, ИИ-чат, управление браузером и генератор HTML-дизайнов.

### Системные требования

| Платформа | Требования |
|-----------|-----------|
| **Windows** | Windows 10+, 200 МБ свободного места |
| **macOS** | macOS 11 (Big Sur)+, Intel или Apple Silicon |
| **Linux** | Ubuntu 20.04+, Debian 11+, Fedora 36+; GTK3; 200 МБ |

### Установка и запуск

```bash
git clone https://github.com/daimo/kursor.git
cd kursor
npm install
npm run electron:dev      # режим разработки с горячей перезагрузкой
```

### Сборка для распространения (Windows)

```bash
# Windows — все архитектуры
npm run electron:build:win           # x64 (Intel/AMD)
npm run electron:build:win:arm       # ARM64 (Snapdragon, Surface Pro X)
npm run electron:build:win:x86       # x86 (32-bit)
npm run electron:build:win:all       # x64 + arm64 + x86 за раз

# macOS и Linux — сборка на целевой ОС
npm run electron:build:mac           # macOS Intel (.dmg, .zip)
npm run electron:build:mac:arm       # macOS Apple Silicon
npm run electron:build:mac:all       # Intel + Apple Silicon
npm run electron:build:linux         # Linux x64 (.AppImage, .deb)
npm run electron:build:linux:arm     # Linux ARM64
npm run electron:build:linux:x86     # Linux x86
npm run electron:build:linux:all     # x64 + arm64 + x86
```

**Результат — папка `release/`:**

| Файл | Архитектура |
|------|-------------|
| `Kursor-Setup-2.0.0-x64.exe` | x64 (Intel/AMD) |
| `Kursor-Setup-2.0.0-arm64.exe` | ARM64 |
| `Kursor-Setup-2.0.0-ia32.exe` | x86 (32-bit) |
| `Kursor-Setup-2.0.0.exe` | Комбинированный (все 3) |

**Чтобы собрать для всех платформ (Windows + macOS + Linux + все архитектуры), нужен CI/CD (например, GitHub Actions) — каждая ОС собирается на своей платформе. Из Windows можно собрать только Windows-версии.**

---
### Режим разработки (с горячей перезагрузкой)

```bash
npm run electron:dev
```

### Все возможности редактора

#### Управление файлами
- Открыть/сохранить файлы (`Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S`)
- Открыть папки (`Ctrl+K`), просмотр дерева файлов
- Несколько рабочих папок (workspace folders)
- Создание/переименование/удаление файлов и папок (контекстное меню)
- Поиск в файлах (без учёта регистра, рекурсивный)
- Недавние файлы

#### Редактор (Monaco)
- Множество вкладок
- Определение языка по расширению (50+ языков)
- Перенос строк, мини-карта, номера строк
- Изменение размера шрифта
- Тёмная/светлая тема
- Простой режим (textarea)

#### Панель проблем
- Маркеры диагностики Monaco (ошибки, предупреждения)
- Сортировка по файлу, строке, столбцу

#### Встроенный предпросмотр
- Предпросмотр HTML/SVG/XML в iframe
- Кнопка открытия в браузере
- Журнал консоли (из iframe)

#### Встроенная консоль
- Перехватывает console.log/warn/error из предпросмотра
- Кнопка очистки

#### Терминал
- Windows: PowerShell или Command Prompt
- macOS: Zsh (по умолчанию) или Bash
- Linux: Bash (по умолчанию) или Zsh
- Автоматический `cd` в открытую папку
- Изменение размера перетаскиванием

#### ИИ-чат
- Режимы чата: Chat, Think, Code, Plan
- Глубина: Maximum, High, Medium, Low
- 50+ пресетов ИИ-провайдеров (OpenAI, Anthropic, Groq, DeepSeek, локальные и др.)
- Стриминговые ответы
- Вложения: файлы, изображения (base64), папки, видео
- Пользовательские промпты
- Управление MCP-серверами
- Поддержка Proxy/VPN (HTTP/HTTPS/SOCKS)
- Автосохранение блоков кода
- Автоответ

#### Управление браузером
- Автоматические клики, прокрутка, печать, навигация
- Оверлей прогресса с индикатором состояния
- Скриншоты
- Получение информации о странице

#### Генератор дизайна
- Генерация HTML-сайтов с помощью ИИ
- Выбор секций (Hero, Features, Pricing, FAQ и др.)
- 5 стилей, 9 цветовых схем
- Ввод URL-адресов для вдохновения и описания
- Предпросмотр, копирование, сохранение

#### ИИ-диагностика
- Анализ активного файла с помощью ИИ
- Результаты отображаются как маркеры Monaco

#### Система разрешений
- ИИ запрашивает разрешение перед действиями (открыть URL, записать/удалить файл, тестировать браузер, читать файл, выполнить команду)
- История разрешений

#### Раскладка
- Изменение ширины боковой панели (перетаскиванием)
- Изменение ширины панели ИИ
- Изменение высоты терминала
- Показать/скрыть боковую панель, терминал, панель ИИ (`Ctrl+\``, `Ctrl+I`)
- Сброс раскладки

#### Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Ctrl+N` | Новый файл |
| `Ctrl+O` | Открыть файл |
| `Ctrl+K` | Открыть папку |
| `Ctrl+S` | Сохранить |
| `Ctrl+Shift+S` | Сохранить как |
| `Ctrl+Z` | Отменить |
| `Ctrl+Shift+Z` | Повторить |
| `Ctrl+X` | Вырезать |
| `Ctrl+C` | Копировать |
| `Ctrl+V` | Вставить |
| `Ctrl+A` | Выделить всё |
| `Ctrl+\`` | Показать/скрыть терминал |
| `Ctrl+I` | Показать/скрыть панель ИИ |

### Настройки

**Общие**: тема (тёмная/светлая), язык (LV/EN/RU), размер шрифта
**Редактор**: перенос строк, мини-карта, номера строк, автосохранение
**Терминал**: оболочка по умолчанию (зависит от платформы)
**Браузер для тестирования**: Chrome, Firefox, Edge, Opera, Safari (только macOS)
**Раскладка**: размеры боковой панели/панели ИИ/терминала

### Известные проблемы

#### macOS — первый запуск
Если macOS блокирует приложение:
```bash
xattr -cr /Applications/Kursor.app
```

#### Linux — отсутствующие зависимости
```bash
# Ubuntu/Debian
sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libatspi2.0-0
# Fedora
sudo dnf install gtk3 libnotify nss libXScrnSaver at-spi2-core
```

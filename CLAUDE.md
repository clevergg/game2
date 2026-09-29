# CLAUDE.md — навигация по проекту

HTML5-игра **«Конторка: Батраканы»** (en: «Kontorka: Workroaches») для **Yandex Games**: idle-кликер с merge по рунет-мему «Конторка». Цель — заработок на рекламе. Мобильный трафик первичен.

## Текущая фаза

- **Фаза 1 — Анализ рынка: ЗАВЕРШЕНА** → [`docs/market-research.md`](docs/market-research.md) (досье мема — §10).
- **Фаза 2 — Концепты и GDD: ЗАВЕРШЕНА** → [`docs/concepts.md`](docs/concepts.md), [`docs/gdd.md`](docs/gdd.md). Выбран концепт K.
- **Фаза 3 — Архитектура: ЗАВЕРШЕНА** → [`docs/architecture.md`](docs/architecture.md), [`docs/roadmap.md`](docs/roadmap.md). Каркас и тулинг готовы, `bun run check` зелёный.
- Ожидается «дальше» → **Фаза 4 (ассеты)**.

Темп ускоренный: цель — отправить MVP на модерацию примерно 20.10.2026. MVP = отдел «Бухгалтерия», 10 рангов.

Работаем строго по фазам. В конце каждой фазы: отчёт в `docs/` + выжимка в чат + СТОП до «дальше».

## Стек (зафиксирован в Фазе 3, обоснование — `docs/architecture.md`)

- **TypeScript 6.0.3** strict, без `any`. TS 7 (нативный, на Go) не берём, пока его не поддержит typescript-eslint.
- **Bun 1.3.11**: пакеты, dev-сервер, бандлер (HTML entry), тесты.
- **Рендер:** свой тонкий слой на Canvas2D за интерфейсом `Renderer`. Запасной план — PixiJS.
- **UI:** DOM-оверлей на **Preact** (единственная runtime-зависимость). Zustand и Tailwind не используем, причины — в architecture §7.
- **Ассеты:** low-poly модели на Three.js → headless Chromium (Playwright) → спрайт-атласы. В игру уходят только PNG. Blender не используем (architecture §2.5).
- **Звук:** синтез через WebAudio в рантайме, аудиофайлов нет.
- **Платформа:** интерфейс `Platform` с реализациями `YandexPlatform` и `LocalPlatform`. SDK грузится динамически с таймаутом 3 с. Ни один метод платформы не бросает исключений.

## Среда разработчика

- Рабочая машина заказчика — **Windows 11**, браузеры для тестов — **Chrome и Firefox** (игра обязана работать в обоих).
- Все скрипты кроссплатформенные: никаких `rm -rf`, `cp`, путей через `/` в строках — только `node:fs`, `node:path`, Bun API.
- `.gitattributes` держит LF во всех текстовых файлах, иначе Prettier на Windows падает на CRLF.
- Генерация ассетов на Windows требует Chromium для Playwright: `bunx playwright install chromium` (один раз).
- Тест с телефона: `bun run dev`, при первом запуске разрешить Bun в брандмауэре Windows для частной сети, открыть на телефоне `http://<IP-компьютера>:5173`.

## Принципы (жёсткие)

- Слои: `core` (чистая логика) ← `game` → `engine` / `ui` / `platform` / `i18n`. `core` зависит только от `data`. Границы проверяет ESLint (`no-restricted-imports`, `no-restricted-globals`).
- Состояние меняется только командами через `core`. `core` сообщает об изменениях событиями в кольцевой буфер, а рендер, звук и UI их потребляют.
- Никаких аллокаций в `update`/`render`: пулы, типизированные массивы, предвыделение.
- Симуляция идёт фиксированным шагом 50 мс (`engine/fixed-step.ts`). На паузе (реклама, скрытая вкладка) цикл полностью останавливается.
- Тесты на чистую логику (`*.test.ts` рядом с кодом): экономика, правила, генерация, сохранения, ad-guard.
- Тач-управление первично. Тач-зоны ≥ 48 px.
- Бюджет сборки: ≤ 2.5 МБ gzip (`package.json → budget`, проверяет `bun run size`).
- Все строки — через словари `i18n` (ru — источник истины, `en: Dict` проверяется типами). Литералы текста в UI запрещены.
- Никаких внешних доменов, ссылок, сторонней аналитики и своей монетизации.
- IP: не копируем ролики, модели, название и логотип ООО «Слоп». Используем общий словарь мема и собственную реализацию.
- Ассеты генерируются скриптами из `scripts/` одной командой. Сгенерированные атласы коммитятся.

## Структура

```
index.html            точка входа сборки
src/main.ts           сборка приложения
src/core/             чистая логика + тесты
src/data/             ранги, отделы, баланс
src/engine/           цикл, рендер, ввод, звук, частицы
src/game/             стейт-машина приложения, связывание слоёв, save-service
src/ui/               Preact: HUD, панели, модалки
src/platform/         Platform, YandexPlatform, LocalPlatform
src/i18n/             словари ru/en, форматирование
src/styles/           CSS
scripts/              build, check-size, генераторы ассетов, pack
assets/               сгенерированные атласы + CREDITS.md
docs/                 документы фаз
```

## Команды

| Команда | Что делает |
|---|---|
| `bun install` | зависимости |
| `bun run dev` | dev-сервер `http://localhost:5173` (слушает `0.0.0.0`, доступен с телефона в той же сети) |
| `bun run build` | сборка в `dist/` |
| `bun run typecheck` | `tsc` по `tsconfig.json` (браузер) и `tsconfig.tools.json` (тесты и скрипты) |
| `bun run lint` | ESLint strictTypeChecked + границы слоёв |
| `bun run format` / `format:check` | Prettier (markdown исключён) |
| `bun test` | юнит-тесты |
| `bun run size` | бюджет сборки |
| `bun run check` | всё сразу — запускать перед каждым коммитом |
| `bun run assets` | генерация ассетов (появится в Фазе 4) |

## Git

- Рабочая ветка: `claude/admiring-turing-o07u8t` (репозиторий `clevergg/game2`).
- Осмысленные коммиты после каждого рабочего блока, `bun run check` перед коммитом.

## Словарь игры (единообразно в коде и доках)

батракан (Workroach), кукиши (figs), колупать циферки (crunch digits), отдел квадров (Department of Human Squares), Хозяин (the Boss), записка (note), шабашка (side gig), слоповина (Slop Pit), дебик (debit bug), премия (bonus), калоидный ускоритель (Coloid Accelerator), реорганизация (restructuring, prestige), выслуга (seniority), картотека (card index), доска почёта (Hall of Fame), аванс (daily advance), отгул (day off, offline income).

## Платформенные факты для сверки (перепроверять перед Фазой 7)

- Архив ≤ 100 МБ до сжатия, `index.html` в корне, без пробелов в именах. `[verify]`
- SDK: `/sdk.js` → `YaGames.init()`; `LoadingAPI.ready()` при готовности к игре; `GameplayAPI.start()/stop()` на входе и выходе из геймплея.
- Реклама: `showFullscreenAdv` (`onOpen`, `onClose(wasShown)`, `onError`), `showRewardedVideo` (+ `onRewarded`). Частоту interstitial контролирует Yandex. Во время показа — пауза звука и геймплея.
- Сохранения: `player.setData` ≤ 200 КБ на игрока, параметр `flush`.
- Лидерборд: `setScore` не чаще 1 раза в секунду, проверка `isAvailableMethod`.
- Язык: `environment.i18n.lang`. Время: `serverTime()`.
- Имена событий внешней паузы (`game_api_pause/resume`) и облачные сохранения анонимов — `[verify]`.
- Авторизация только через Yandex ID (опционально), сторонняя запрещена.

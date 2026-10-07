# CLAUDE.md — навигация по проекту

HTML5-игра **«Конторка: Батраканы»** (en: «Kontorka: Workroaches») для **Yandex Games**: idle-кликер с merge по рунет-мему «Конторка». Цель — заработок на рекламе. Мобильный трафик первичен.

## Текущая фаза

- **Фаза 1 — Анализ рынка: ЗАВЕРШЕНА** → [`docs/market-research.md`](docs/market-research.md) (досье мема — §10).
- **Фаза 2 — Концепты и GDD: ЗАВЕРШЕНА** → [`docs/concepts.md`](docs/concepts.md), [`docs/gdd.md`](docs/gdd.md). Выбран концепт K.
- **Фаза 3 — Архитектура: ЗАВЕРШЕНА** → [`docs/architecture.md`](docs/architecture.md), [`docs/roadmap.md`](docs/roadmap.md). Каркас и тулинг готовы, `bun run check` зелёный.
- **Фаза 4 — Ассеты: ЗАВЕРШЕНА** → [`docs/art-direction.md`](docs/art-direction.md), превью в `docs/img/phase4-*.png`. Атлас 260 кадров, 163.5 КБ; звук синтезируется в коде.
- **Фаза 5 — Вертикальный срез: ЗАВЕРШЕНА** → [`docs/vertical-slice.md`](docs/vertical-slice.md) (запуск на ПК/телефоне, чек-лист теста). Играбелен цикл тап → найм → слияние → ранг; сборка 188 КБ gzip, TTI 1.8 с на slow 4G + CPU×4.
- **Плейтест среза (07.10):** игра проходится < 10 мин. Диагноз и варианты долгой прогрессии → [`docs/progression.md`](docs/progression.md): экономика «взрывная» (бот берёт ранг 10 за 12 с), рекомендовано направление A «Вертикаль Конторки» (этажи-отделы до кабинета Хозяина + реорганизация + смены/поручения).
- **Фаза 6 — «Вертикаль Конторки»: ЗАВЕРШЕНА** → [`docs/phase6.md`](docs/phase6.md). Решения заказчика 07.10: направление A, 3 этажа к модерации, персонажи с именами (Тося Бося, Кудесница Алеся). GDD v0.2 — раздел 0 в [`docs/gdd.md`](docs/gdd.md). Экономика v2 + симулятор темпа, события и дневные слои, Склад и Конторка дизайнеров, лифт, отдел квадров, поручения, имитация рекламы. Сборка 572 КБ gzip, TTI 2,4 с.
- **Фаза 7 — Интеграция Yandex SDK: ЗАВЕРШЕНА** → [`docs/phase7.md`](docs/phase7.md). `YandexPlatform` (SDK с таймаутом, реклама, облако, лидерборд `career`, `serverTime`, внешняя пауза), матрица отказов, архив `bun run pack`. Заказчик загружает архив в черновик и создаёт лидерборд `career` (phase7 §4).
- **Фаза 8 — Публикация: ЗАВЕРШЕНА** → [`docs/publishing.md`](docs/publishing.md). Промо кодом (`bun run promo`: иконка, обложки ru/en, скриншоты телефон/ПК ru/en), тексты страницы ru/en, пошаговая инструкция, чек-лист модерации. Широкий экран — офис в 4 колонки. Осталось заказчику: пройти черновик и отправить на модерацию.

Темп ускоренный: цель — отправить MVP на модерацию ~24–27.10.2026. MVP = 3 этажа (Бухгалтерия, Склад, Конторка дизайнеров) по 10 рангов, GDD §0.9.

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
| `bun run assets` | генерация атласа `assets/atlas.png` + `atlas.json` и превью `docs/img/phase4-*.png` (нужен Chromium для Playwright) |
| `bun run audio:preview` | рендер всех звуков и музыки в WAV (`.cache/audio-preview/`) для прослушивания |
| `bun run smoke` | сборка + автоплейтест в эмуляции телефона (Playwright): 18 проверок (вкл. позднюю игру: отгул, лифт, перки, реклама), TTI на slow 4G, скриншоты `docs/img/phase6-*.png` |
| `bun run smoke:sdk` | матрица отказов платформы с поддельным SDK: ok / hang / broken (входит в `smoke`) |
| `bun run pack` | сборка + проверки требований Яндекса + `release/kontorka-<версия>.zip` для консоли |
| `bun run promo` | промо для страницы игры: иконка 512, обложки 800×470 ru/en, скриншоты 1080×1920 и 1920×1080 ru/en → `release/promo/`, `release/kontorka-promo.zip` |
| `bun run balance` | симулятор баланса: бот играет 40 ч на настоящем core, вехи против целей GDD §0.10 (`--no-events` — пассивный игрок) |

## Git

- Рабочая ветка: `claude/admiring-turing-o07u8t` (репозиторий `clevergg/game2`).
- Осмысленные коммиты после каждого рабочего блока, `bun run check` перед коммитом.

## Ассеты (Фаза 4)

- Генератор: `scripts/assets/` — `page/` работает в headless Chromium (модели Three.js, рендер по ID материалов), `lib/` — чистые утилиты с тестами (PNG с палитрой, дизеринг, обводка, упаковка, шрифт).
- Палитра — `src/data/palette.ts` (22 рампы по 4 оттенка). Внешность рангов — `scripts/assets/page/looks.ts`.
- Листы атласа: `atlas.png` (общее + этаж 1, грузится сразу), `atlas-1.png` (Склад), `atlas-2.png` (дизайнеры) — грузятся лениво. `atlas.json`: `sheets`, `frames[name] = [x, y, w, h, ax, ay, лист]`, `anims[name] = { frames, fps, loop }`. Кадры этажей — с префиксом `f{этаж}_` (`f1_b5_idle_0`, `f2_desk`, `f0_floor`). Батракан и стол рисуются в одну точку-якорь: сначала стол, потом батракан.
- Линейки рангов и темы этажей — `scripts/assets/page/looks.ts` (`FLOOR_THEMES`), NPC — `models/characters.ts`. Новые рампы палитры — только в конец `RAMPS`.
- Спрайт, упёршийся в край кадра, роняет генерацию с именем — расширять `FrameSpec` в `page/main.ts`.
- Звук: `src/engine/audio/` (`synth.ts`, `sfx.ts` с нормализацией громкости, `music.ts`).
- Playwright закреплён на 1.56.1 (Chromium ревизии 1194) ради побайтно одинакового результата.

## Карта кода (Фаза 5)

- `src/core/`: `state.ts` (OfficeState по этажам, всё предвыделено), `commands.ts` (найм, слияние, покупки, этажи, реорганизация, перки — возвращают 0 или DENY), `live-state.ts` + `live.ts` (события и дневные слои: записки, дебики, кредики, проверка, баффы, смена, поручения, аванс, отгул), `ad-guard.ts` (частота рекламы), `sim.ts` (выплаты, автослияние, шаг событий), `events.ts` (кольцевой буфер EV), `economy.ts` (формулы), `save.ts` (схема v2 + миграция v1, слой live необязателен).
- `src/data/balance.ts` — все числа: `BALANCE` (экономика), `LIVE` (события, награды в секундах дохода), `ADS`. Инварианты — в `src/core/*.test.ts`, темп — `scripts/balance/balance.test.ts`.
- `src/engine/`: `atlas.ts` (имена → индексы), `renderer.ts` (Canvas2D, DPR ≤ 2, без сглаживания), `input.ts` (тап/драг, один указатель), `particles.ts` (пулы частиц и всплывающих чисел пиксельным шрифтом), `audio/player.ts`.
- `src/game/`: `app.ts` (сборка, ввод → команды, события → тосты/окна, лифт, дни, отгул), `scene.ts` (рисование этажа, записка/дебик/кредик, хит-тесты), `ads.ts` (реклама + пауза + ad-guard), `snapshot.ts` (состояние → данные UI, с тестами), `days.ts`, `layout.ts`, `tutorial.ts`.
- `src/ui/`: `store.ts` (типы снимка, хук useStore), `actions.ts`, `App.tsx` (HUD, лифт, нижняя панель), `Panels.tsx` (отдел квадров, поручения), `Modals.tsx`, `Icon.tsx`.
- `src/platform/`: интерфейс `Platform` (время, сохранения, пауза, реклама, лидерборд, вход); `yandex.ts` — SDK с относительного `/sdk.js`, таймаут 3 с, все вызовы обёрнуты; `cloud.ts` — выбор свежего сохранения и ограничитель записи (с тестами); `local.ts` — `LocalPlatform(fakeAds)`. `main.ts` на localhost/LAN вне фрейма SDK не ищет; `?platform=yandex|local` — принудительно.
- `src/game/pause.ts` — пауза по причинам (вкладка, реклама, `game_api_pause`).
- `scripts/pack/` — ZIP-упаковщик и правила архива (с тестами); `scripts/smoke-sdk.ts` — поддельный SDK.
- Компактные числа: `src/i18n/format.ts` — один алгоритм для DOM и пиксельного шрифта.

## Словарь игры (единообразно в коде и доках)

батракан (Workroach), кукиши (figs), колупать циферки (crunch digits), отдел квадров (Department of Human Squares), Хозяин (the Boss), записка (note), шабашка (side gig), слоповина (Slop Pit), дебик (debit bug), премия (bonus), калоидный ускоритель (Coloid Accelerator), реорганизация (restructuring, prestige), выслуга (seniority), картотека (card index), доска почёта (Hall of Fame), аванс (daily advance), отгул (day off, offline income).

## Платформенные факты (сверены в Фазе 7, источники — docs/phase7.md §2)

- Архив ≤ 100 МБ до сжатия, `index.html` в корне, имена без пробелов и кириллицы. Модерация 3–5 рабочих дней.
- SDK: `/sdk.js` → `YaGames.init()`; `LoadingAPI.ready()` при готовности к игре; `GameplayAPI.start()/stop()` на входе и выходе из геймплея.
- Реклама: `showFullscreenAdv` (`onOpen`, `onClose(wasShown)`, `onError`), `showRewardedVideo` (+ `onRewarded`). Частоту interstitial контролирует Yandex. Во время показа — пауза звука и геймплея.
- Сохранения: `player.setData` ≤ 200 КБ на игрока, параметр `flush`.
- Лидерборд: новый API `ysdk.leaderboards.setScore/getEntries`, ≤ 60 запросов в минуту, проверка `isAvailableMethod`. Наш лидерборд — `career`.
- Язык: `environment.i18n.lang`. Время: `serverTime()`.
- Внешняя пауза: `ysdk.on("game_api_pause" | "game_api_resume")`. Облачные сохранения анонимов — проверить в черновике.
- Авторизация только через Yandex ID (опционально), сторонняя запрещена.

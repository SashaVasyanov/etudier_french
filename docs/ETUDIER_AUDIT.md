# Аудит работоспособности Étudier

**Проверенный commit:** `224563b`
**Стек:** React 18, TypeScript, Vite 7, Tauri 2
**Область аудита:** сборка и запуск, UI/UX, производительность, локальная персистентность, ежедневный урок и цикл интервального повторения.

## 1. Итоговый вердикт

Приложение **собирается и основной пользовательский путь работает**, но текущую версию нельзя считать надёжной для длительного обучения без исправления SRS и persistence.

Что работает:

- lint, TypeScript build и web build проходят;
- Rust/Tauri backend проходит `cargo check`;
- выбор 10/20/30 минут сохраняется и реально меняет размер занятия;
- ежедневный урок можно пройти через пять модулей до экрана «На сегодня заданий нет»;
- дополнительный урок не перезаписывает daily record;
- словарь, профиль, статистика, паки, японский раздел и тренировка ключей открываются;
- данные хранятся локально и повреждённый JSON не приводит к падению приложения.

Критические ограничения:

1. SRS способен повысить новое слово до `mastered` за одну сессию и назначить чрезмерный интервал.
2. `next_review_at` не является обязательным фильтром для ряда статусов, поэтому слова возвращаются не по расписанию.
3. Ошибки чтения/записи `localStorage` скрываются; повреждённое состояние молча заменяется пустым.
4. Модель смешивает пользовательское «Уже знаю» и алгоритмическое `mastered`.
5. У приложения нет unit/integration test script для детерминированной проверки SRS и migrations.

## 2. Критерии приёмки аудита

- [x] Зафиксированы реальные результаты lint/typecheck/build/smoke/Tauri check.
- [x] Проверены ежедневный урок, все пять модулей, extra mode и длительности 10/20/30.
- [x] Проверены словарь, профиль, статистика, паки, импорт, Japanese/radicals и narrow viewport.
- [x] Найдены подтверждённые проблемы оптимизации, UI и повторения.
- [x] Для блокирующих проблем приведены evidence, влияние и решение.
- [x] Сформирован приоритетный roadmap и план улучшения QA-процесса.

## 3. Детерминированные проверки

| Проверка | Результат | Комментарий |
|---|---:|---|
| `npm run lint` | PASS | ESLint завершился с exit 0. |
| `npm run typecheck` | PASS | `tsc -b --pretty false`, exit 0. |
| `npm run build` | PASS | Vite 7.3.6, 78 modules, `dist` создан. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | Tauri crate компилируется. |
| `npm run test` | FAIL / missing | Скрипт `test` отсутствует в `package.json:6-21`. |
| `npm run ui:test:safari` | FLAKY | Были независимые PASS-прогоны и один FAIL на overflow kanji-choice (`scripts/ui-smoke-safari.mjs:366-376`). |
| Preview lifecycle | PASS | `preview:host` отвечал HTTP 200; после остановки — HTTP 000. |

Существующий Safari smoke действительно проверяет recovery повреждённого storage, французский урок и feedback, словарь, профиль/статистику, Japanese/radicals, речь, delayed retry и narrow viewport. Однако тест использует случайное перемешивание, поэтому kanji overflow воспроизводится стохастически.

## 4. Runtime-матрица пользовательских путей

| Сценарий | Статус | Evidence / ограничение |
|---|---:|---|
| Главная и основные разделы навигации | PASS | Реальный Safari smoke и статическая трассировка CTA. |
| Длительность 10/20/30 | PASS | После reload сохраняется; получены 27 / 61 / 86 шагов соответственно. |
| Daily lesson, пять модулей, completion | PASS с дефектом edge case | Обычный путь проходит 5 модулей; пустые модули и empty lesson отображаются некорректно — см. SRS-03. |
| Extra после daily completion | PASS | Daily record не перезаписывается. |
| Dictionary: поиск, табы, level | PASS с UX-дефектами | Нет known-фильтра, direct «Уже знаю» и empty-state. |
| Packs: просмотр detail | PASS | Detail и обе практики открываются. |
| Валидный импорт пака | PASS | Пак появляется и открывается. |
| Невалидный импорт | FAIL | Ввод молча очищается, ошибки нет. |
| Практика не добавленного пака | PASS технически / FAIL модели | Запускается, но пак остаётся `not_added` и не входит в общий словарь. |
| Profile/history/statistics | PASS с дефектами метрик | Маршруты работают; streak и окна 7/30 дней могут вводить в заблуждение. |
| Japanese/radicals/speech/retry | PASS с flaky UI | Основные сценарии работают; kanji-choice иногда переполняет кнопку. |
| Narrow viewport | PASS в smoke | Горизонтальный overflow страницы не обнаружен в успешном прогоне. |
| Keyboard navigation основных CTA | PARTIAL / FAIL-attempted | Enter используется в smoke; отдельная сквозная Tab-проверка не завершила открытие lesson и не считается PASS. |
| Полный Tauri bundle/install | NOT TESTED | Выполнен `cargo check`, но полный `tauri:build` в этом аудите не запускался. |

## 5. Подтверждённые проблемы цикла повторения и данных

### SRS-01 — CRITICAL: mastery достигается внутри одной сессии

**Evidence:**

- `src/lib/storage.ts:398-437` — `resolveStatus` использует накопленные ответы и `repetition_step`, но не требует успешных повторений в разные даты;
- `src/lib/storage.ts:569-635` — каждый exercise немедленно увеличивает step и интервал;
- `src/lib/storage.ts:709-728` — outcomes одной сессии применяются последовательно;
- runtime probe подтвердил переход нового слова в `mastered` после восьми ответов и интервал до 60 дней.

**Влияние:** пользователь может увидеть слово много раз подряд, после чего приложение сочтёт его долговременно выученным и уберёт на слишком большой срок.

**Решение:** агрегировать результаты по слову за сессию и делать не более одного SRS-transition на слово; mastery разрешать только после нескольких успешных due-review в разные календарные дни; первый интервал ограничить 1–3 днями.

### SRS-02 — HIGH: расписание `next_review_at` применяется непоследовательно

**Evidence:**

- `src/lib/exercises.ts:535-567` — `difficult` и `learning` выбираются без due-проверки; due применяется только к `review`;
- `src/lib/exercises.ts:360-375,631-674` — long-term `mastered` выбирается по возрасту/retrievability, а не как строгий due item.

**Влияние:** перегрузка повторениями, нарушение интервального расписания, невозможность объяснить пользователю очередь на сегодня.

**Решение:** единый селектор `isDue(progress, now)` для всех неновых статусов; отдельные лимиты `due`, `new`, `reinforcement`; внедрить clock dependency вместо прямого `Date.now()`.

### SRS-03 — HIGH: пять модулей могут быть формально завершены, оставаясь пустыми

**Evidence:**

- `src/lib/exercises.ts:745-864` всегда формирует пять daily modules даже при недостатке meaningful content;
- `src/App.tsx:546-565` записывает `completedModules = activeSession.modules.length`;
- `src/App.tsx:380-394` создаёт empty completion record, когда session не сформирована;
- `src/components/HomeDashboard.tsx:170-175` отображает fallback `5 из 5` даже для пустого completion;
- runtime probe подтвердил состояние с четырьмя пустыми модулями.

**Влияние:** completion и история утверждают, что пользователь выполнил работу, которой не было.

**Решение:** либо наполнять каждый модуль реальными шагами, либо показывать честный отдельный state «Нет слов, требующих повторения» без фиктивного `5/5`; completed modules считать по завершённым непустым module IDs.

### SRS-04 — HIGH: «Уже знаю» смешано с `mastered`

**Evidence:**

- `src/types.ts:1` не содержит статуса `known`;
- `src/lib/storage.ts:731-751` сохраняет «Уже знаю» как `mastered`;
- `src/lib/exercises.ts:360-375` допускает long-term memory checks для mastered;
- последующий правильный outcome может перевести такой объект в `review`, если он ещё не удовлетворяет счётчикам mastery.

**Влияние:** пользовательская декларация знания и алгоритмическое освоение имеют разные смыслы, но статистика и очередь их не различают.

**Решение:** вернуть отдельный `known` status/flag. `known` исключать из new queue; повторять только по явному opt-in или отдельной проверке; `mastered` оставлять результатом SRS.

### DATA-01 — HIGH: тихий сброс и тихие ошибки `localStorage`

**Evidence:**

- `src/lib/storage.ts:277-387` на любой parse/normalization exception возвращает default storage;
- `src/lib/storage.ts:390-395` скрывает ошибки записи;
- `src/App.tsx:235-256` записывает весь storage после каждого изменения с debounce 180 ms и при `pagehide`.

**Влияние:** quota, corruption или несовместимая migration могут незаметно уничтожить видимый прогресс после reload.

**Решение:** schema version + migrations; перед reset сохранять quarantine/backup исходной строки; `saveStorage` должен возвращать result; показывать пользователю persistent error; разделить progress/history/settings по ключам либо использовать Tauri store/SQLite.

### DATA-02 — HIGH: `wordsLearned` повторно считает уже освоенные слова

**Evidence:** `src/App.tsx:517-520` считает все source words со статусом learning/review/mastered после занятия, а не фактические переходы статуса.

**Влияние:** история и KPI растут повторно при повторении тех же слов.

**Решение:** считать set переходов `before.status !== mastered && after.status === mastered`; отдельно хранить practiced/reviewed words.

### DATA-03 — MEDIUM: shallow copy допускает мутацию входного state

**Evidence:** `src/lib/storage.ts:709-718` копирует массив `dailyStats`, но не его элементы; `src/lib/storage.ts:661-679` мутирует найденный объект.

**Решение:** immutable map/update либо Immer; unit test должен проверять, что `applyOutcomes(input)` не меняет `input`.

### DATA-04 — MEDIUM: пустая flashcard-сессия изменяет streak и completed lessons

**Evidence:** `finishLesson` вызывает `applyOutcomes` для всех режимов (`src/App.tsx:498-543`), а `updateDailyStats` увеличивает completed lesson даже для пустого массива (`src/lib/storage.ts:638-679`).

**Решение:** не считать сессию без оценённых exercises учебным completion; для flashcards ввести отдельную метрику `cardsReviewed` и явный outcome.

### DATA-05 — MEDIUM: лимиты custom data применяются скрытым усечением только при reload

**Evidence:** normalization режет custom words/packs в `src/lib/storage.ts:364-374`, тогда как add operations в `src/lib/storage.ts:910-933,1015-1026` не отклоняют превышение заранее.

**Решение:** проверять лимит при записи, возвращать typed error, показывать его в UI; не удалять элементы при следующем запуске молча.

### DATA-06 — MEDIUM: stale streak и «7/30 дней» считаются как записи

**Evidence:**

- `src/components/ProfileScreen.tsx:46-48` использует `slice(-7)`/`slice(-30)` по sessions;
- `src/components/ProfileScreen.tsx:135-138` отображает сохранённый streak без today guard;
- только `StatisticsScreen.tsx:162` сбрасывает display streak, если last lesson не сегодня.

**Решение:** группировать по календарным date keys, строить непрерывную последовательность дат и использовать один shared selector во всех экранах.

## 6. Подтверждённые UI/UX-проблемы

### UX-01 — HIGH: невалидный импорт молча уничтожает введённые данные

**Evidence:** `src/App.tsx:901-909` ничего не сообщает при `parseImportedPack() === null`; `src/components/PacksScreen.tsx:77-81` очищает оба поля независимо от результата. Runtime подтверждён.

**Решение:** `onImportPack` возвращает discriminated result; очищать форму только при success; показывать строку/причину ошибки и пример допустимого формата.

### UX-02 — HIGH: controls не имеют программных label

**Evidence:** search/filter controls в `src/components/DictionaryScreen.tsx:233-254`, pack filters в `src/components/PackDetailScreen.tsx:125-134` и import controls в `src/components/PacksScreen.tsx:56-70` полагаются на placeholder/option text.

**Решение:** видимые `<label for>` либо `aria-label`; добавить axe/accessibility smoke и проверку Tab order/focus-visible.

### UX-03 — MEDIUM: словарь не выполняет product requirement known/«Уже знаю»

**Evidence:** `src/types.ts:6` и `src/components/DictionaryScreen.tsx:22-27` не содержат known tab; карточки `DictionaryScreen.tsx:276-323` предлагают только audio/details, без status action.

**Решение:** после разделения `known`/`mastered` добавить отдельный фильтр и действие с undo/toast; обновление должно исключать known из new queue.

### UX-04 — MEDIUM: нет empty-state и сброса фильтров

**Evidence:** `DictionaryScreen.tsx:276-323` рендерит только map; при нуле карточек пользователь видит пустое пространство. Аналогичный риск есть в `PackDetailScreen.tsx:142-178`.

**Решение:** state «Ничего не найдено», показать активные фильтры и CTA «Сбросить фильтры».

### UX-05 — MEDIUM: kanji-choice overflow воспроизводится стохастически

**Evidence:** assertion `scripts/ui-smoke-safari.mjs:366-376` минимум один раз завершил smoke с exit 1; независимый повтор прошёл. Причина зависит от случайной пары слова/дистракторов.

**Решение:** CSS `min-width:0`, устойчивое wrapping/line-height и тест worst-case strings; smoke должен использовать seed и фиксированный набор самых длинных вариантов.

### UX-06 — MEDIUM: пак можно практиковать до добавления, но он остаётся `not_added`

**Evidence:** pack CTA запускают lesson/cards в `src/App.tsx:930-947` без проверки pack state; общий словарь использует только active packs.

**Решение:** выбрать одно правило: (a) автоматически добавить пак перед практикой; либо (b) явно назвать режим preview и не сохранять pack progress как подключённый. UI должен объяснять результат.

## 7. Оптимизация и архитектура

### PERF-01 — HIGH: дистрибутив почти полностью состоит из изображений

Фактический замер:

- `dist`: **134.48 MiB**;
- изображения: **130.27 MiB**, 2 120 файлов;
- крупнейший файл: около **5.73 MB**;
- **539** изображений не связаны с актуальным manifest/data, потенциальная экономия около **18.7 MB**.

**Решение:** генерировать manifest whitelist, удалять dead assets только воспроизводимым скриптом, конвертировать изображения в WebP/AVIF с ограничениями размеров, добавить CI budgets: total assets, max single image, orphan count = 0.

### PERF-02 — MEDIUM: широкие dependencies вызывают повторные O(N)-вычисления

**Evidence:** `src/App.tsx:174-196` зависит от всего `storage` для enabled pack IDs, lesson pool и progress list; `src/components/HomeDashboard.tsx:90-95` пересчитывает completion паков при любом изменении storage.

**Решение:** зависимости на `packStates`/`progressByWordId`; один memoized selector status snapshot; профилировать React Profiler на 2 000 custom words.

### PERF-03 — MEDIUM: PackDetail рендерит весь pack

**Evidence:** `src/components/PackDetailScreen.tsx:51-69,142-178` фильтрует и map-ит весь список; Dictionary уже использует pagination по 80.

**Решение:** переиспользовать pagination/virtualization Dictionary; измерить время render для лимита 2 000 слов.

### PERF-04 — MEDIUM: manual chunk lesson engine остаётся eager

**Evidence:** `vite.config.ts:15-17` создаёт chunk, но `src/App.tsx:15` импортирует engine статически; built index содержит static import.

**Решение:** либо lazy import engine при старте lesson, либо убрать искусственный split; принимать решение по startup trace, а не по числу chunk-файлов.

### PERF-05 — LOW: tracked generated artifacts создают drift

Tracked: `vite.config.js`, `vite.config.d.ts`, `tsconfig.app.tsbuildinfo`, `tsconfig.node.tsbuildinfo`, `public/data/words.json`.

**Решение:** подтвердить source-of-truth, убрать generated outputs из индекса и добавить `.gitignore`; не применять слепой `git rm` без обновления build/data-generation scripts.

### PERF-06 — LOW/INFO

- `removeWordFromSession` использует `stepId.includes(wordId)` (`src/App.tsx:78-95`): сейчас collision не подтверждён, но точное сравнение по `step.wordId` безопаснее.
- большой `specific` literal в `buildNounExample` создаётся на каждый вызов при загрузке данных; hoist даст небольшую экономию, но это не render bottleneck.
- `word_images.json` около 2 MB и смешивает языки; language-specific manifests уменьшат parse/load и упростят orphan validation.

## 8. Рекомендуемый roadmap

### P0 — до следующего релиза

1. Зафиксировать текущее поведение unit-тестами SRS и storage.
2. Исправить SRS-01/SRS-02: один transition на слово за session, due gate, clock/RNG injection.
3. Разделить `known` и `mastered` с migration старого storage.
4. Добавить versioned persistence, backup/quarantine и видимую ошибку записи.
5. Исправить пустые modules/completion и статистические transitions.
6. Исправить silent invalid import.

### P1 — следующий спринт

1. Known filter/action, empty states, labels и keyboard flow.
2. Исправить pack-state inconsistency.
3. Исправить stale streak и календарные окна.
4. Детерминировать Safari smoke и kanji worst-case.
5. Удалить orphan images скриптом и ввести asset budgets.

### P2 — оптимизация и поддерживаемость

1. Разделить `App.tsx`, `storage.ts`, `exercises.ts` на state machine/selectors/repositories.
2. Разделить storage keys или перейти на Tauri store/SQLite.
3. Lazy-load language datasets/manifests и lesson engine по измерениям.
4. Пагинация/виртуализация больших паков.
5. Убрать tracked generated artifacts после проверки pipeline.

## 9. Улучшение процесса разработки и QA

### Обязательные scripts

Добавить единый `npm test`, который включает:

- unit: SRS transitions, intervals, due selection, status migrations;
- property/invariant tests: counts never decrease incorrectly, no empty completed modules, input state immutable;
- storage: corrupted JSON, old schema migration, quota error, limits;
- integration: daily → completion → extra isolation, pack state, known exclusion;
- UI: import errors, empty states, labels, keyboard;
- deterministic Safari/Playwright smoke с seed.

### CI quality gates

В `.github/workflows/build.yml` job `web-build` сейчас запускает только frontend build, а `windows-package` уже выполняет `npm run tauri:build`. Следующие quality gates следует применять к обоим релевантным job, сохранив существующую Windows packaging-проверку. Рекомендуемый минимум:

1. `npm ci`;
2. `npm run lint`;
3. `npm run typecheck`;
4. `npm test`;
5. deterministic UI smoke;
6. `cargo check`;
7. asset audit (`orphan = 0`, max image, total bundle budget);
8. Tauri build хотя бы на release branches.

### Наблюдаемые продуктовые метрики

- due words planned/completed;
- retention после 1/3/7/30 дней;
- lapse rate по типу exercise;
- сколько слов повышено до mastered по дням, не по ответам;
- session abandonment по module/step;
- storage write failures и migration failures;
- p50/p95 startup, dictionary filter latency, pack render time;
- asset size и Tauri installer size.

## 10. Ограничения аудита

- Полный native `npm run tauri:build` и установка bundle не выполнялись; проверены web build и `cargo check`.
- Сквозная Tab-only navigation осталась PARTIAL/FAIL-attempted.
- UI smoke не полностью детерминирован из-за случайного выбора слов/дистракторов.
- Аудит не исправлял продуктовые файлы; он формирует доказанный backlog и порядок исправлений.
- В рабочем дереве до аудита уже были изменены `tsconfig*.tsbuildinfo` и присутствовали untracked mobile icons; они сохранены.

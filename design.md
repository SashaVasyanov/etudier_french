# Anki Plus — дизайн приложения для изучения слов

## Цель
Сделать приложение для изучения слов с механиками, максимально близкими к Skyeng по логике упражнений, но с фокусом на точечную тренировку словаря и простую ежедневную практику.


Приложение должно тренировать:
- распознавание слова на слух;
- сопоставление перевода и оригинала;
- активное воспроизведение слова;
- быстрое повторение в формате коротких уроков.

Язык, который изучает пользователь в MVP: **французский**. Перевод интерфейса и перевод слов — на **русский**.

---

## Основная концепция
Пользователь изучает слова через короткие уроки.
Каждый урок состоит из набора карточек слов и нескольких типов упражнений.
Основной сценарий: пользователь запускает урок, проходит упражнения, получает результат, а приложение сохраняет прогресс по каждому слову.

Интерфейс и логика должны быть похожи на приложения для изучения языков уровня Skyeng:
- крупные карточки;
- минималистичный интерфейс;
- одна задача на экран;
- большие кнопки вариантов ответа;
- заметный прогресс-бар;
- звук как важная часть опыта.

---

## Формат слова в базе
Для каждого слова должны храниться следующие поля:

```json
{
  "id": "uuid",
  "original": "pomme",
  "translation": "яблоко",
  "transcription": "ˈæpəl",
  "audio_original": "path_or_url",
  "example_original": "Je mange une pomme.",
  "example_translation": "Я съел яблоко.",
  "part_of_speech": "noun",
  "level": "A1",
  "tags": ["food"],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Минимально обязательные поля:
- `id`
- `original`
- `translation`
- `audio_original`

---

## Сценарий обучения
Один дневной урок по умолчанию:
- 10 новых слов;
- несколько упражнений на каждое слово;
- слова затем уходят в систему повторения.

Для одного слова приложение должно уметь показывать несколько типов заданий, чтобы проверять его с разных сторон:
- узнавание на слух;
- узнавание перевода;
- узнавание оригинала;
- ввод слова вручную.

---

## Типы упражнений
Ниже перечислены обязательные типы упражнений. Их нужно реализовать в точности по логике, указанной ниже.

### 1. 4 слова на выбор — выбрать перевод того, что прозвучало
**Что происходит:**
- автоматически воспроизводится аудио слова на оригинальном языке;
- на экране отображаются 4 варианта перевода;
- пользователь должен выбрать правильный перевод услышанного слова.

**Пример:**
- звучит: `pomme`
- варианты:
  - яблоко
  - стол
  - дорога
  - окно
- правильный ответ: `яблоко`

**Требования:**
- должна быть кнопка повторного воспроизведения аудио;
- варианты должны перемешиваться случайно;
- неправильные варианты должны быть взяты из слов того же урока или из общего пула слов близкого уровня;
- после ответа нужно показать, правильно ли ответил пользователь;
- после неправильного ответа нужно показать правильный вариант.

---

### 2. 4 слова на выбор — выбрать оригинал слова
**Что происходит:**
- на экране показывается перевод слова на родном языке пользователя;
- ниже отображаются 4 варианта слова на изучаемом языке;
- пользователь выбирает правильный оригинал.

**Пример:**
- вопрос: `яблоко`
- варианты:
  - pomme
  - table
  - road
  - window
- правильный ответ: `pomme`

**Требования:**
- варианты должны быть визуально одинаковыми кнопками;
- после ответа нужно показывать корректный вариант;
- по желанию может быть доступна кнопка прослушивания правильного слова.

---

### 3. 4 слова на выбор — выбрать правильный перевод
**Что происходит:**
- на экране показывается слово на оригинальном языке в текстовом виде;
- ниже — 4 варианта перевода;
- пользователь выбирает правильный перевод.

**Пример:**
- вопрос: `pomme`
- варианты:
  - яблоко
  - стол
  - дорога
  - окно
- правильный ответ: `яблоко`

**Требования:**
- слово должно быть крупным и хорошо читаемым;
- при наличии аудио должна быть отдельная кнопка озвучки;
- после ответа отображается правильный перевод и статус ответа.

---

### 4. Написать слово, которое прозвучало в оригинале
**Что происходит:**
- приложение проигрывает аудио слова;
- пользователь должен вручную ввести слово на оригинальном языке;
- ответ проверяется по словарной форме.

**Пример:**
- звучит: `pomme`
- пользователь должен ввести: `pomme`

**Требования:**
- обязательна кнопка повторного воспроизведения;
- проверка должна быть нечувствительной к лишним пробелам в начале и конце;
- регистр можно сделать нечувствительным для базовой версии;
- после ошибки приложение показывает правильный ответ;
- желательно подсвечивать посимвольные ошибки;
- можно добавить кнопку «Показать ответ» с фиксацией, что слово было не угадано.

---

## Экранная структура приложения

## 1. Главный экран
Содержит:
- кнопку `Начать урок`;
- блок `Сегодняшний прогресс`;
- количество новых слов;
- количество слов на повторение;
- текущую серию дней;
- быстрый переход в словарь.

### Элементы главного экрана
- верхний заголовок с названием приложения;
- карточка прогресса за день;
- большая основная кнопка запуска урока;
- разделы:
  - `Новые слова`
  - `Повторение`
  - `Мои наборы`
  - `Статистика`

---

## 2. Экран упражнения
Общий шаблон для всех типов заданий.

### Обязательные элементы
- прогресс-бар сверху;
- номер задания, например `3 из 20`;
- кнопка выхода назад;
- область вопроса;
- область вариантов ответа или поле ввода;
- кнопка звука, если задание связано с аудио;
- блок мгновенной обратной связи после ответа;
- кнопка `Далее`.

### Поведение
- на экране только одно упражнение;
- после выбора варианта нельзя случайно нажать другой;
- состояние ответа фиксируется сразу;
- затем показывается результат и кнопка перехода дальше.

---

## 3. Экран результата урока
Содержит:
- количество правильных ответов;
- процент успеха;
- список слов, в которых были ошибки;
- кнопку повторить ошибки;
- кнопку завершения урока.

Дополнительно:
- мотивационное сообщение;
- мини-статистика по типам упражнений.

---

## Логика формирования вариантов ответа
Для упражнений с 4 вариантами всегда должен быть:
- 1 правильный ответ;
- 3 правдоподобных дистрактора.

### Правила выбора дистракторов
- не использовать дубликаты;
- не использовать правильный ответ повторно среди неверных;
- по возможности подбирать слова той же части речи;
- по возможности подбирать слова близкого уровня сложности;
- при малом наборе слов использовать глобальный словарь.

### Перемешивание
- правильный ответ не должен систематически стоять на одной и той же позиции;
- порядок вариантов перемешивается при каждом показе.

---

## Логика проверки ответов

### Для выбора варианта
- ответ считается правильным только при точном совпадении с целевым значением.

### Для ввода слова
- базовая версия:
  - trim пробелов;
  - сравнение без учета регистра;
- расширенная версия:
  - поддержка допустимых альтернатив;
  - учет британского/американского варианта;
  - мягкая проверка с подсветкой опечаток.

---

## Система прогресса по словам
Для каждого слова нужно хранить статистику:

```json
{
  "word_id": "uuid",
  "shown_count": 12,
  "correct_count": 9,
  "wrong_count": 3,
  "last_seen_at": "timestamp",
  "next_review_at": "timestamp",
  "ease_factor": 2.3,
  "status": "learning"
}
```

### Статусы слова
- `new` — новое;
- `learning` — в изучении;
- `review` — на повторении;
- `mastered` — хорошо закреплено.

---

## UX-требования

### Визуальный стиль
- чистый современный интерфейс;
- светлая тема как базовая;
- крупная типографика;
- скругленные карточки и кнопки;
- минимум визуального шума.

### Удобство
- большие области нажатия;
- мгновенный отклик на действие;
- поддержка клавиатуры для ввода;
- быстрый переход к следующему заданию;
- понятная цветовая индикация правильного и неправильного ответа.

### Обратная связь
После ответа показывать:
- правильно / неправильно;
- правильный ответ;
- при необходимости оригинал + перевод;
- кнопку перехода дальше.

---

## Звуковая логика
Аудио — ключевая часть приложения.

Требования:
- у слова должен быть аудиофайл или TTS;
- звук должен запускаться без заметной задержки;
- в аудио-упражнениях должна быть кнопка повторного прослушивания;
- желательно ограничение на слишком частый spam-клик по кнопке звука через короткий debounce.

---

## Минимальный пользовательский поток
1. Пользователь открывает приложение.
2. Нажимает `Начать урок`.
3. Проходит серию упражнений:
   - выбрать перевод по озвучке;
   - выбрать оригинал;
   - выбрать перевод;
   - ввести услышанное слово;
4. Получает итоговый экран.
5. Ошибочные слова попадают в отдельный блок повторения.

---

## MVP
Для первой версии приложения обязательно реализовать:
- экран главного меню;
- экран урока;
- 4 обязательных типа упражнений;
- проигрывание аудио;
- проверку ответов;
- случайную генерацию 3 неверных вариантов;
- сохранение прогресса;
- экран результатов.

---

## Что должно быть похоже на Skyeng
Приложение должно наследовать следующие ощущения от Skyeng:
- обучение маленькими шагами;
- одно действие на экран;
- сильный акцент на аудио;
- быстрые упражнения без перегрузки;
- частое переключение между форматами задания;
- понятный и приятный интерфейс.

При этом нельзя перегружать экран лишними панелями, сложной статистикой или второстепенными действиями во время урока.

---

## Технические заметки для Codex
При генерации приложения Codex должен учитывать:
- архитектуру с отдельными сущностями `Word`, `Lesson`, `Exercise`, `UserProgress`;
- переиспользуемый компонент `MultipleChoiceExercise`;
- отдельный компонент `AudioInputExercise`;
- единый экран урока, который рендерит разные типы упражнений по конфигурации;
- поддержку локальной базы данных или JSON-хранилища для MVP;
- возможность позже расширить до интервального повторения.

### Рекомендуемые типы упражнений в коде
```ts
export type ExerciseType =
  | 'audio_to_translation_choice'
  | 'translation_to_original_choice'
  | 'original_to_translation_choice'
  | 'audio_to_original_input';
```

### Пример структуры упражнения
```ts
export interface Exercise {
  id: string;
  type: ExerciseType;
  wordId: string;
  prompt: string;
  audioUrl?: string;
  choices?: string[];
  correctAnswer: string;
}
```

---


## Критерий готовности
Дизайн можно считать реализованным правильно, если в приложении есть:
- уроки со словами;
- четыре обязательных режима упражнений;
- логика, визуально и поведенчески близкая к Skyeng;
- понятный современный интерфейс;
- работа со звуком;
- сохранение результатов по словам.

---

## Готовый prompt для Codex

Скопируй этот prompt целиком в Codex:

```text
Create a complete MVP application called “Anki Plus” for vocabulary learning.

Main goal:
Build a word-learning app with exercise mechanics very close to Skyeng-style vocabulary training. The UI should feel modern, minimal, clean, and mobile-first / responsive, with one exercise per screen, large touch targets, clear progress bar, and strong emphasis on audio.

Language of interface:
Learning language: French (words shown in French, translations in Russian).
Russian.
All button labels, titles, statuses, and helper text must be in Russian.
Code can be in English.

Core product requirements:
The app must support short lessons for studying vocabulary words.
Each word can appear in several exercise formats.
The MVP must include exactly these 4 exercise types:

1) audio_to_translation_choice
- Play audio of the original word.
- Show 4 translation options.
- User selects the correct translation for the spoken word.

2) translation_to_original_choice
- Show the translation in Russian.
- Show 4 original-language word options.
- User selects the correct original word.

3) original_to_translation_choice
- Show the original word as text.
- Show 4 translation options.
- User selects the correct translation.

4) audio_to_original_input
- Play audio of the original word.
- User types the original word manually.
- Validation should compare dictionary form.
- Ignore leading/trailing spaces.
- Make validation case-insensitive in MVP.

Important behavior requirements:
- One exercise per screen.
- Top progress bar with current step, for example “3 из 20”.
- Instant answer validation.
- After answering, lock the current exercise state and show result feedback.
- Then allow moving forward with a “Далее” button.
- For audio-based tasks, include a replay audio button.
- For multiple-choice tasks, randomly shuffle answer order every time.
- Each multiple-choice exercise must have 1 correct answer and 3 plausible distractors.
- Distractors should preferably come from the same lesson or same difficulty level.
- Do not allow duplicate choices.
- After wrong answers, show the correct answer.

Lesson flow:
- Home screen with:
  - app title
  - “Начать урок” button
  - today progress card
  - new words count
  - review words count
  - streak indicator
  - quick navigation blocks: “Новые слова”, “Повторение”, “Мои наборы”, “Статистика”
- Lesson screen
- Result screen with:
  - number of correct answers
  - success percentage
  - list of words with mistakes
  - button to repeat mistakes
  - button to finish lesson
  - small motivational message

Data model:
Use a local in-app dataset for MVP.
Each word should have fields similar to:
- id
- original
- translation
- transcription
- audio_original
- example_original
- example_translation
- part_of_speech
- level
- tags

Progress model per word:
- word_id
- shown_count
- correct_count
- wrong_count
- last_seen_at
- next_review_at
- ease_factor
- status

Word statuses:
- new
- learning
- review
- mastered

Technical requirements:
- Build a complete runnable MVP.
- Choose a practical modern frontend stack suitable for Codex to generate quickly.
- Preferred: React + TypeScript + Vite.
- Styling: clean modern CSS, CSS modules, or Tailwind if it helps speed and structure.
- Keep architecture simple and maintainable.
- Create reusable components for:
  - MultipleChoiceExercise
  - AudioInputExercise
  - ProgressBar
  - LessonResult
  - HomeDashboard
- Use a single lesson screen that renders exercise types by configuration.
- Use local JSON or in-memory seed data for the first version.
- Include sample vocabulary data so the app works immediately after launch.
- Audio can use browser TTS as fallback if real audio files are unavailable.
- The app must be fully functional without any backend.

UX requirements:
- Clean light theme.
- Large readable typography.
- Rounded cards and buttons.
- Very low visual clutter.
- Clear green/red feedback for correct/incorrect states.
- Large tap/click areas.
- Fast transitions.
- Keyboard support for text input.

Implementation details:
- Generate a realistic sample lesson with around 10 words.
- For each lesson session, generate several exercises across all 4 types.
- Ensure the same word can appear in different exercise modes.
- Implement scoring and mistake tracking.
- Save progress in localStorage.
- Add a simple repeat-mistakes mode after lesson completion.

Audio behavior:
- Auto-play audio when needed if browser allows it.
- Also provide an explicit replay button.
- Prevent broken UX if autoplay is blocked.

Code quality requirements:
- Clear folder structure.
- Strong TypeScript typing.
- No placeholder pseudo-code.
- Produce full files, not fragments.
- Make the project easy to run locally.

Please output:
1) Full project structure.
2) All source files.
3) Package configuration.
4) Sample data.
5) Short run instructions.

Also make sure the final app behavior stays close to Skyeng-style vocabulary drills, but do not clone branding or proprietary assets.
```

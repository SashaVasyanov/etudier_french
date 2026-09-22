import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const baseUrl = process.env.UI_BASE_URL ?? 'http://127.0.0.1:1420';
const outputDirectory = process.env.UI_OUTPUT_DIR ?? '/tmp/etudier-qa';
const storageKey = 'anki-plus-storage';
const draftKey = 'anki-plus-daily-draft-french';
const seed = Number(process.env.UI_SEED ?? 305419896) >>> 0;
const errors = [];
const results = [];
let browser;
let page;

const stored = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').payload, storageKey);
const draft = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.draft ?? null, draftKey);
const button = (name) => page.getByRole('button', { name, exact: true });
const navigate = async (name) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
const pause = async () => page.locator('.lesson-close-button').click();
const screenshot = async (name) => page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: true });

async function check(name, action) {
  console.log(`Checking ${name}...`);
  await action();
  results.push(name);
}

function comparable(value) {
  return value.trim().toLocaleLowerCase().replace(/[’]/g, "'").replace(/^(?:le |la |les |l')/, '');
}

// Answers come from the imported public dictionary, visible prompts/input IDs,
// and the speech API. No React internals or application functions are accessed.
async function findExerciseWord(words) {
  const input = page.locator('.lesson-card input');
  if (await input.count()) {
    const id = await input.getAttribute('id');
    const found = words.find((word) => id?.includes(`${word.id}-`));
    if (found) return found;
  }
  const prompt = page.locator('.lesson-card .lesson-prompt-title, .lesson-card .lesson-memory-word');
  if (await prompt.count()) {
    const text = (await prompt.first().innerText()).trim();
    const found = words.find((word) => word.translation === text || comparable(word.original) === comparable(text));
    if (found) return found;
  }
  const replay = button('Повторить аудио');
  if (await replay.count()) {
    await page.evaluate(() => { window.__qaSpeech = []; });
    await replay.click();
    await expect.poll(() => page.evaluate(() => window.__qaSpeech.length)).toBeGreaterThan(0);
    const speech = await page.evaluate(() => window.__qaSpeech.at(-1));
    const found = words.find((word) => comparable(word.original) === comparable(speech));
    if (found) return found;
  }
  throw new Error(`Cannot identify exercise from public UI: ${await page.locator('.lesson-card').innerText()}`);
}

async function completeLesson(words, { mistake = false } = {}) {
  await expect(page.locator('.lesson-card')).toBeVisible();
  const modules = new Set();
  let wrongAnswerSent = false;
  let retrySeen = false;
  let answered = 0;
  const trace = [];
  for (let step = 0; step < 150; step += 1) {
    if (await page.locator('.result-card').count()) return { modules: [...modules], retrySeen, answered, trace };
    await expect(page.locator('.lesson-card')).toBeVisible();
    const moduleLabel = await page.locator('.lesson-session-module').innerText();
    modules.add(moduleLabel);
    await expect(page.getByRole('progressbar', { name: 'Общий прогресс урока' })).toBeVisible();
    const preview = button('Понял, дальше');
    if (await preview.count()) {
      await preview.click();
      continue;
    }
    const eyebrow = await page.locator('.lesson-card .eyebrow').first().innerText();
    trace.push(eyebrow);
    if (eyebrow.toLocaleLowerCase() === 'возврат к ошибке') retrySeen = true;
    const word = await findExerciseWord(words);
    const wrong = mistake && !wrongAnswerSent;
    const choices = page.locator('.lesson-card .choice-button');
    if (await choices.count()) {
      const labels = await choices.allTextContents();
      const correct = await page.locator('.lesson-image-choice-card').count() ? word.original : word.translation;
      const index = labels.findIndex((label) => wrong ? label.trim() !== correct : label.trim() === correct);
      assert.ok(index >= 0, `No ${wrong ? 'wrong' : 'correct'} choice for ${word.original}`);
      await choices.nth(index).click();
    } else if (await button('Помню').count()) {
      await button(wrong ? 'Не помню' : 'Помню').click();
    } else {
      await page.locator('.lesson-card input').fill(wrong ? 'ошибка теста' : word.original);
      await button('Проверить').click();
    }
    await expect(page.locator('.answer-feedback')).toHaveClass(wrong ? /error/ : /success/);
    wrongAnswerSent ||= wrong;
    answered += 1;
    await button('Дальше').click();
  }
  throw new Error('Lesson exceeded 150 steps; possible retry loop');
}

try {
  await fs.mkdir(outputDirectory, { recursive: true });
  browser = await chromium.launch({ headless: process.env.UI_HEADLESS !== 'false' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
  await context.addInitScript((initialSeed) => {
    let state = initialSeed;
    Math.random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
    window.__qaSpeech = [];
    // Headless Chromium has no OS voice. Observe the same public speech API
    // while making its completion deterministic and silent.
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ lang: 'fr-FR', name: 'French QA', voiceURI: 'qa-fr', localService: true }, { lang: 'ja-JP', name: 'Japanese QA', voiceURI: 'qa-ja', localService: true }],
      speak: (utterance) => { window.__qaSpeech.push(utterance.text); queueMicrotask(() => utterance.onend?.()); },
      cancel() {}, addEventListener() {}, removeEventListener() {},
    } });
  }, seed);
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl);
  await expect(page.locator('.learning-home')).toBeVisible();

  await check('duration controls and durable settings', async () => {
    for (const duration of [30, 20, 10]) {
      await button(`${duration} мин`).click();
      await expect.poll(async () => (await stored()).lessonWordTarget).toBe(duration);
      await expect(button(`${duration} мин`)).toHaveAttribute('aria-pressed', 'true');
    }
    await page.reload();
    await expect(button('10 мин')).toHaveAttribute('aria-pressed', 'true');
    await screenshot('01-home');
  });

  await check('dictionary search, filters, known words and custom-word form', async () => {
    await navigate('Словарь');
    const search = page.locator('.dictionary-toolbar input');
    await search.fill('bonjour');
    await expect(page.locator('.word-card').first()).toContainText('bonjour');
    await page.locator('.word-card').first().getByRole('button', { name: /как уже известное/ }).click();
    await button('Известные').click();
    await expect(page.locator('.word-card')).toHaveCount(1);
    await expect(page.locator('.word-card').getByRole('button', { name: /уже отмечено/ })).toBeDisabled();
    await search.fill('несуществующее-слово-qa');
    await expect(page.getByText('Ничего не найдено', { exact: true })).toBeVisible();
    await button('Сбросить фильтры').click();
    for (const label of ['Изучаемые', 'Выученные', 'Сложные', 'Все слова']) await button(label).click();
    await button('Добавить слово').click();
    await page.getByLabel('Французское слово', { exact: true }).fill('   ');
    await page.getByLabel('Перевод', { exact: true }).fill('   ');
    await button('Сохранить слово').click();
    await expect(page.locator('.custom-word-form [role="alert"]')).toBeVisible();
    await page.getByLabel('Французское слово', { exact: true }).fill('qa-lumière');
    await page.getByLabel('Перевод', { exact: true }).fill('тестовый свет');
    await button('Сохранить слово').click();
    await expect(page.locator('.custom-word-form')).toHaveCount(0);
    await search.fill('qa-lumière');
    await expect(page.locator('.word-card')).toHaveCount(1);
    await screenshot('02-dictionary');
  });

  let pack;
  await check('pack inspection, import validation, practice and flashcards', async () => {
    await navigate('Темы');
    await page.locator('.pack-card').first().getByRole('button', { name: 'Открыть', exact: true }).click();
    await expect.poll(() => page.locator('.word-card').count()).toBeGreaterThanOrEqual(20);
    await button('Добавить пак').click();
    await expect(button('Пак добавлен')).toBeDisabled();
    await page.getByLabel('Поиск внутри пака').fill('несуществующее-qa');
    await button('Сбросить фильтры').click();
    await button('Назад к пакам').click();
    await page.getByLabel('Название пака').fill('QA French');
    await page.getByLabel('Слова и переводы').fill('неверная строка');
    await button('Импортировать пак').click();
    await expect(page.locator('#pack-import-message')).toHaveAttribute('role', 'alert');
    await page.getByLabel('Слова и переводы').fill('qa-alpha\tальфа\nqa-beta\tбета\nqa-gamma\tгамма');
    await button('Импортировать пак').click();
    await expect(page.locator('#pack-import-message')).toContainText('Пак добавлен');
    await expect.poll(async () => (await stored()).customPacks.some((entry) => entry.title === 'QA French')).toBe(true);
    pack = (await stored()).customPacks.find((entry) => entry.title === 'QA French');
    assert.equal(pack.words.length, 3);
    await page.locator('.pack-card').filter({ hasText: 'QA French' }).getByRole('button', { name: 'Открыть', exact: true }).click();
    await expect(page.locator('.word-card')).toHaveCount(3);
    await button('Учить этот пак').click();
    await expect(page.locator('.lesson-card')).toBeVisible();
    await pause();
    await navigate('Темы');
    await page.locator('.pack-card').filter({ hasText: 'QA French' }).getByRole('button', { name: 'Открыть', exact: true }).click();
    await button('Карточки пака').click();
    await button('Показать перевод').click();
    await expect(page.locator('.flashcard-panel')).toHaveClass(/revealed/);
    await button('Повторить позже').click();
    await pause();
  });

  await check('profile name and lesson source selection', async () => {
    await navigate('Профиль');
    await page.getByLabel('Имя профиля').fill('Анна QA');
    await page.locator('label.settings-row').filter({ hasText: 'Источник слов' }).locator('select').selectOption(pack.id);
    await expect.poll(async () => (await stored()).lessonSourcePackId).toBe(pack.id);
    await page.reload();
    await navigate('Профиль');
    await expect(page.getByLabel('Имя профиля')).toHaveValue('Анна QA');
    await expect(page.locator('label.settings-row').filter({ hasText: 'Источник слов' }).locator('select')).toHaveValue(pack.id);
    await navigate('Главная');
  });

  await check('daily pause, reload and resume without lost steps', async () => {
    await button('Начать урок').click();
    await button('Понял, дальше').click();
    await expect.poll(async () => (await draft())?.stepIndex).toBe(1);
    const previousWord = await page.locator('.lesson-preview-title').innerText();
    await pause();
    await expect(button('Продолжить урок')).toBeVisible();
    await page.reload();
    await button('Продолжить урок').click();
    await expect(page.locator('.lesson-preview-title')).toHaveText(previousWord);
    assert.equal((await draft()).stepIndex, 1);
    const savedDailyDraft = await draft();
    await pause();
    await button('Микс заданий').click();
    await expect(page.locator('.lesson-card')).toBeVisible();
    if (await button('Понял, дальше').count()) await button('Понял, дальше').click();
    assert.deepEqual(await draft(), savedDailyDraft, 'Extra practice overwrote the paused daily lesson');
    await pause();
    await button('Продолжить урок').click();
    await expect(page.locator('.lesson-preview-title')).toHaveText(previousWord);
    await screenshot('03-resumed-lesson');
  });

  let dailyCompletion;
  await check('all five daily modules, a delayed retry and durable completion', async () => {
    const run = await completeLesson(pack.words, { mistake: true });
    assert.equal(run.modules.length, 5);
    assert.equal(run.retrySeen, true, `Missing retry: ${JSON.stringify(run.trace)}`);
    await expect.poll(async () => (await stored()).completedDailyLessons.length).toBe(1);
    const state = await stored();
    dailyCompletion = state.completedDailyLessons[0];
    assert.equal(dailyCompletion.completedModules, 5);
    assert.equal(dailyCompletion.totalSteps, dailyCompletion.completedSteps);
    assert.equal(state.studyHistory.filter((entry) => entry.mode === 'default').length, 1);
    assert.equal(await draft(), null);
    await screenshot('04-daily-completion');
    await button('На главную').click();
    await expect(page.getByText('На сегодня заданий нет', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('На сегодня заданий нет', { exact: true })).toBeVisible();
  });

  await check('extra practice and repeat mistakes preserve the completed daily lesson', async () => {
    await button('Продолжить практику').click();
    await completeLesson(pack.words, { mistake: true });
    await expect(button('Повторить ошибки')).toBeEnabled();
    await button('Повторить ошибки').click();
    await completeLesson(pack.words);
    await expect.poll(async () => (await stored()).studyHistory.length).toBe(3);
    const state = await stored();
    assert.deepEqual(state.completedDailyLessons, [dailyCompletion]);
    assert.deepEqual(state.studyHistory.map((entry) => entry.mode), ['default', 'extra', 'mistakes']);
    await button('На главную').click();
    await screenshot('05-post-daily-home');
  });

  await check('profile history and calendar-based statistics navigation', async () => {
    await navigate('Профиль');
    await expect(page.locator('.settings-history-item')).toHaveCount(3);
    await expect(page.locator('.settings-summary-list')).toContainText('уроков за 7 дней');
    await navigate('Прогресс');
    await expect(page.locator('.analytics-page')).toBeVisible();
    await expect(page.locator('.analytics-week-chart .analytics-week-bar')).toHaveCount(7);
    await button('Показать части речи').click();
    await expect(button('Показать уровни слов')).toBeVisible();
    await button('Показать уровни слов').click();
    await screenshot('06-statistics');
  });

  await check('Japanese navigation, dictionary and independent radical learning', async () => {
    await navigate('Профиль');
    await page.locator('label.settings-row').filter({ hasText: 'Учебный язык' }).locator('select').selectOption('japanese');
    await navigate('Главная');
    await expect(page.locator('.home-language-chip')).toContainText('JP');
    await navigate('Словарь');
    await page.locator('.dictionary-toolbar input').fill('разговор / история');
    await expect(page.locator('.word-card')).toHaveCount(1);
    await expect(page.locator('.word-card')).toContainText('話');
    await navigate('Ключи');
    await expect(page.locator('.radical-card')).toHaveCount(214);
    await page.locator('.radical-search input').fill('龠');
    await expect(page.locator('.radical-card')).toHaveCount(1);
    await page.locator('.radical-card').click();
    await expect(page.locator('.radical-detail-page')).toContainText('Несколько трубок флейты');
    await button('Все ключи').click();
    await page.locator('.radical-search input').fill('');
    await page.getByRole('button', { name: /Основные/ }).click();
    await expect(page.locator('.radical-card')).toHaveCount(31);
    await button('Начать тренировку').click();
    for (let index = 0; index < 10; index += 1) {
      await page.locator('.radical-option').first().click();
      await expect(page.locator('.radical-feedback')).toBeVisible();
      await page.locator('.radical-feedback button').click();
    }
    await expect(page.locator('.radical-result-page')).toBeVisible();
    await expect.poll(async () => (await stored()).radicalStudyHistory.length).toBe(1);
    assert.equal((await stored()).radicalStudyHistory.length, 1);
    assert.equal((await stored()).studyHistory.length, 3);
    await screenshot('07-japanese-radicals');
    await button('К каталогу').click();
    await navigate('Профиль');
    await page.locator('label.settings-row').filter({ hasText: 'Учебный язык' }).locator('select').selectOption('french');
    await navigate('Главная');
    await expect(page.getByText('На сегодня заданий нет', { exact: true })).toBeVisible();
  });

  await check('known-word removal, empty practice and minimum desktop viewport', async () => {
    const edgeContext = await browser.newContext({ viewport: { width: 1100, height: 760 }, locale: 'ru-RU' });
    page = await edgeContext.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl);
    await expect(page.locator('.learning-home')).toBeVisible();
    await navigate('Темы');
    await page.getByLabel('Название пака').fill('Known edge');
    await page.getByLabel('Слова и переводы').fill('qa-first\tпервый\nqa-second\tвторой\nqa-third\tтретий');
    await button('Импортировать пак').click();
    await expect.poll(async () => (await stored()).customPacks.length).toBe(1);
    const edgePack = (await stored()).customPacks[0];
    await navigate('Профиль');
    await page.locator('label.settings-row').filter({ hasText: 'Источник слов' }).locator('select').selectOption(edgePack.id);
    await navigate('Главная');
    await button('Начать урок').click();
    await button('Уже знаю это слово').click();
    const currentWord = await page.locator('.lesson-preview-title').innerText();
    await pause();
    await navigate('Словарь');
    await page.locator('.dictionary-toolbar input').fill(currentWord);
    await page.locator('.word-card').getByRole('button', { name: /как уже известное/ }).click();
    await navigate('Главная');
    await button('Продолжить урок').click();
    await expect(page.locator('.lesson-preview-title')).not.toHaveText(currentWord);
    await button('Уже знаю это слово').click();
    await expect(page.locator('.result-card')).toBeVisible();
    assert.deepEqual((await stored()).completedDailyLessons, [], 'Known-only session falsely completed daily lesson');
    await button('Продолжить обучение').click();
    await expect(page.getByRole('status')).toContainText('Все слова в этой подборке уже известны');
    await button('Открыть паки').click();
    await expect(page.locator('.pack-card').filter({ hasText: 'Known edge' })).toBeVisible();
    for (const name of ['Главная', 'Словарь', 'Темы', 'Профиль', 'Прогресс']) {
      await navigate(name);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Horizontal overflow: ${name}`);
    }
    await screenshot('08-minimum-desktop');
    await edgeContext.close();
  });

  assert.deepEqual(errors, [], 'Uncaught browser errors');
  await fs.writeFile(path.join(outputDirectory, 'report.json'), JSON.stringify({ baseUrl, seed, passed: results, errors }, null, 2));
  console.log(`Chromium smoke passed: ${results.length} scenarios. Screenshots: ${outputDirectory}`);
} catch (error) {
  if (page) {
    await screenshot('failure').catch(() => {});
    await fs.writeFile(path.join(outputDirectory, 'failure.html'), await page.content()).catch(() => {});
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
}

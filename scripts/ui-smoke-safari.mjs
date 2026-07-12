import { Builder, By, Key, until } from 'selenium-webdriver';
import assert from 'node:assert/strict';

const baseUrl = process.env.UI_BASE_URL ?? 'http://127.0.0.1:4173';
const storageKey = 'anki-plus-storage';
const timeoutMs = 15000;

async function findNavigationButton(driver, text) {
  return driver.wait(
    until.elementLocated(By.xpath(`//button[.//strong[normalize-space()="${text}"]]`)),
    timeoutMs,
  );
}

async function main() {
  let driver;

  try {
    console.log('Starting Safari WebDriver session...');
    driver = await new Builder().forBrowser('safari').build();
    await driver.manage().setTimeouts({
      implicit: 0,
      pageLoad: timeoutMs,
      script: timeoutMs,
    });
    await driver.manage().window().setRect({ width: 1440, height: 900, x: 0, y: 0 });

    console.log(`Opening ${baseUrl}...`);
    await driver.get(baseUrl);
    console.log('Checking recovery from corrupted local storage...');
    await driver.executeScript(`window.localStorage.setItem("${storageKey}", "{invalid-json")`);
    await driver.navigate().refresh();

    console.log('Waiting for app shell...');
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Начать урок")]')), timeoutMs);
    await driver.executeScript(
      `window.localStorage.setItem("${storageKey}", JSON.stringify({ dailyStats: [null], studyHistory: [null], customPacks: [null], progressByWordId: { bad: null } }))`,
    );
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Начать урок")]')), timeoutMs);
    await driver.executeScript(`window.localStorage.removeItem("${storageKey}")`);
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Начать урок")]')), timeoutMs);
    assert.equal((await driver.findElements(By.css('.nav-icon svg'))).length, 6, 'Navigation icons are incomplete');
    const brandMetrics = await driver.executeScript(
      `const logo = document.querySelector('.sidebar-logo');
       const mark = logo?.querySelector('span')?.getBoundingClientRect();
       const label = logo?.querySelector('strong')?.getBoundingClientRect();
       return {
         title: document.title,
         label: logo?.querySelector('strong')?.textContent?.trim(),
         markCenter: mark ? mark.top + (mark.height / 2) : null,
         labelCenter: label ? label.top + (label.height / 2) : null,
       };`,
    );
    assert.equal(brandMetrics.title, 'étudier', 'Window title is inconsistent with the product name');
    assert.equal(brandMetrics.label, 'étudier', 'Sidebar brand contains an extra product suffix');
    assert.ok(
      brandMetrics.markCenter !== null
        && brandMetrics.labelCenter !== null
        && Math.abs(brandMetrics.markCenter - brandMetrics.labelCenter) <= 1,
      'Sidebar brand mark and label are not vertically aligned',
    );

    console.log('Starting lesson...');
    const startLessonButton = await driver.findElement(By.xpath('//button[contains(., "Начать урок")]'));
    await startLessonButton.sendKeys(Key.ENTER);

    console.log('Waiting for study view...');
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Понял, дальше")]')), timeoutMs);

    console.log('Moving to the first exercise...');
    for (let index = 0; index < 20; index += 1) {
      const previewButtons = await driver.findElements(By.xpath('//button[normalize-space()="Понял, дальше"]'));

      if (previewButtons.length === 0) {
        break;
      }

      await previewButtons[0].sendKeys(Key.ENTER);
    }

    await driver.wait(until.elementLocated(By.css('.choice-button')), timeoutMs);
    const choiceButtons = await driver.findElements(By.css('.choice-button'));
    assert.ok(choiceButtons.length > 0, 'The first exercise has no answer choices');
    assert.equal((await driver.findElements(By.css('.japanese-kanji-choice'))).length, 0, 'French choices received Japanese styling');
    await choiceButtons[0].sendKeys(Key.ENTER);
    await driver.wait(until.elementLocated(By.css('.answer-feedback')), timeoutMs);
    await driver.wait(until.elementLocated(By.xpath('//button[normalize-space()="Прослушать ещё раз"]')), timeoutMs);

    console.log('Checking dictionary list limit...');
    const closeLessonButton = await driver.findElement(By.xpath('//button[@aria-label="Выйти из урока"]'));
    await closeLessonButton.sendKeys(Key.ENTER);
    const dictionaryButton = await findNavigationButton(driver, 'Словарь');
    await dictionaryButton.sendKeys(Key.ENTER);
    await driver.wait(until.elementLocated(By.css('.dictionary-grid')), timeoutMs);
    const renderedWordCards = await driver.findElements(By.css('.dictionary-grid > .word-card'));
    assert.ok(renderedWordCards.length > 0 && renderedWordCards.length <= 80, 'Dictionary rendered too many cards');

    console.log('Checking profile and statistics routes...');
    const profileButton = await findNavigationButton(driver, 'Профиль');
    await profileButton.sendKeys(Key.ENTER);
    await driver.wait(until.elementLocated(By.css('.settings-page')), timeoutMs);

    console.log('Checking Japanese examples, kanji typography and answer details...');
    await driver.executeScript(
      "const select = [...document.querySelectorAll('label select')].find((item) => item.closest('label')?.textContent?.includes('Учебный язык')); if (!select) throw new Error('Language select not found'); select.value = 'japanese'; select.dispatchEvent(new Event('change', { bubbles: true }));",
    );
    await driver.wait(
      async () => {
        const languageSelects = await driver.findElements(By.xpath('//label[contains(., "Учебный язык")]//select'));

        return languageSelects.length === 1 && (await languageSelects[0].getAttribute('value')) === 'japanese';
      },
      timeoutMs,
    );
    const homeButton = await findNavigationButton(driver, 'Главная');
    await homeButton.sendKeys(Key.ENTER);
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Начать урок")]')), timeoutMs);
    assert.ok((await driver.findElement(By.css('.home-language-chip')).getText()).includes('JP'), 'Japanese home label is incorrect');

    console.log('Checking corrected Japanese translations...');
    const japaneseDictionaryButton = await findNavigationButton(driver, 'Словарь');
    await japaneseDictionaryButton.sendKeys(Key.ENTER);
    await driver.wait(until.elementLocated(By.css('.dictionary-toolbar input')), timeoutMs);
    const dictionarySearch = await driver.findElement(By.css('.dictionary-toolbar input'));
    await dictionarySearch.sendKeys('разговор / история');
    await driver.wait(
      async () => (await driver.findElements(By.css('.dictionary-grid > .word-card'))).length === 1,
      timeoutMs,
    );
    console.log('Corrected 話 translation verified.');
    let correctedCardText = await driver.findElement(By.css('.dictionary-grid > .word-card')).getText();
    assert.ok(correctedCardText.includes('話'), 'Corrected 話 entry is missing');
    assert.ok(correctedCardText.includes('разговор / история'), '話 still displays the rare dictionary gloss');
    await dictionarySearch.clear();
    await dictionarySearch.sendKeys('господин / госпожа');
    await driver.wait(
      async () => (await driver.findElements(By.css('.dictionary-grid > .word-card'))).length === 1,
      timeoutMs,
    );
    console.log('Corrected 様 translation verified.');
    correctedCardText = await driver.findElement(By.css('.dictionary-grid > .word-card')).getText();
    assert.ok(correctedCardText.includes('様'), 'Corrected 様 entry is missing');
    assert.ok(correctedCardText.includes('[さま · sama]'), '様 still uses the contextually incorrect reading');
    await dictionarySearch.clear();
    await dictionarySearch.sendKeys(' ');
    await driver.wait(
      async () => (await driver.findElements(By.css('.dictionary-grid > .word-card'))).length === 80,
      timeoutMs,
    );
    console.log('Japanese dictionary image grid loaded.');
    const japaneseImageMetrics = await driver.executeScript(
      `const images = [...document.querySelectorAll('.dictionary-grid > .word-card .word-image')];
       return {
         count: images.length,
         localCount: images.filter((image) => image.getAttribute('src')?.startsWith('data:image/svg+xml')).length,
         semanticCount: images.filter((image) => image.dataset.imageSource === 'generated:semantic-svg-v2').length,
         emptyAltCount: images.filter((image) => !image.getAttribute('alt')?.trim()).length,
         illustrationTypes: [...new Set(images.map((image) => image.dataset.illustrationType).filter(Boolean))],
       };`,
    );
    console.log(`Japanese image types: ${japaneseImageMetrics.illustrationTypes.join(', ')}`);
    assert.equal(japaneseImageMetrics.count, 80, 'Japanese dictionary image coverage is incomplete');
    assert.equal(japaneseImageMetrics.localCount, 80, 'Japanese mnemonic images are not fully local');
    assert.equal(japaneseImageMetrics.semanticCount, 80, 'Japanese words did not receive semantic illustrations');
    assert.equal(japaneseImageMetrics.emptyAltCount, 0, 'Japanese images have missing alternative text');
    assert.ok(japaneseImageMetrics.illustrationTypes.length >= 10, 'Japanese mnemonic illustrations are not diverse enough');
    await (await findNavigationButton(driver, 'Главная')).sendKeys(Key.ENTER);
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Начать урок")]')), timeoutMs);

    await driver.findElement(By.xpath('//button[contains(., "Начать урок")]')).sendKeys(Key.ENTER);
    await driver.wait(until.elementLocated(By.xpath('//button[normalize-space()="Понял, дальше"]')), timeoutMs);
    const japanesePreviewWord = await driver.findElement(By.css('.lesson-preview-title')).getText();
    const japaneseReading = await driver.findElement(By.css('.lesson-preview-description')).getText();
    const japaneseExample = await driver.findElement(By.css('.lesson-preview-example')).getText();
    const japaneseExampleReading = await driver.findElement(By.css('.japanese-example-reading')).getText();
    const japaneseExampleTranslation = await driver.findElement(By.css('.lesson-preview-example-translation')).getText();
    assert.ok(japaneseExample.includes(japanesePreviewWord), 'Japanese example does not contain the studied word');
    assert.ok(/[\u3040-\u309f]/.test(japaneseExampleReading), 'Japanese example has no hiragana reading');
    assert.ok(!/[\p{Script=Han}\p{Script=Katakana}]/u.test(japaneseExampleReading), 'Japanese example reading is not hiragana-only');
    assert.ok(!/よく使う言葉/.test(japaneseExample), 'Japanese example still uses the generic frequency template');
    assert.ok(!/^(?:Слово |«.+» — часто)/.test(japaneseExampleTranslation), 'Japanese example was not contextually translated');
    console.log('Checking Japanese speech reading...');
    const audioHookInstalled = await driver.executeScript(
      `window.__spokenTexts = [];
       const speech = window.speechSynthesis;
       window.__originalSpeechSpeak = speech.speak;
       window.__originalSpeechUtterance = window.SpeechSynthesisUtterance;
       window.SpeechSynthesisUtterance = class {
         constructor(text) {
           this.text = text;
           window.__spokenTexts.push(text);
         }
       };
       const capture = (utterance) => {
         queueMicrotask(() => utterance.onend?.());
       };
       try {
         speech.speak = capture;
       } catch {
         Object.defineProperty(speech, 'speak', { configurable: true, value: capture });
       }
       return speech.speak === capture;`,
    );
    assert.equal(audioHookInstalled, true, 'Unable to observe Japanese speech synthesis');
    await driver.sleep(250);
    await driver.findElement(By.xpath('//button[normalize-space()="Прослушать"]')).sendKeys(Key.ENTER);
    await driver.wait(
      async () => (await driver.executeScript('return window.__spokenTexts?.length ?? 0')) > 0,
      timeoutMs,
    );
    const spokenJapanese = await driver.executeScript('return window.__spokenTexts[0]');
    const expectedJapaneseReading = japaneseReading.replace(/^\[|]$/g, '').split('·')[0]?.trim();
    assert.equal(spokenJapanese, expectedJapaneseReading, 'Japanese audio did not use the dictionary reading');
    assert.ok(!/\p{Script=Han}/u.test(spokenJapanese), 'Japanese audio still receives kanji');
    await driver.executeScript(
      `if (window.__originalSpeechSpeak) window.speechSynthesis.speak = window.__originalSpeechSpeak;
       if (window.__originalSpeechUtterance) window.SpeechSynthesisUtterance = window.__originalSpeechUtterance;
       delete window.__spokenTexts;
       delete window.__originalSpeechSpeak;
       delete window.__originalSpeechUtterance;`,
    );
    console.log('Japanese speech reading verified.');

    for (let index = 0; index < 20; index += 1) {
      const previewButtons = await driver.findElements(By.xpath('//button[normalize-space()="Понял, дальше"]'));

      if (previewButtons.length === 0) break;
      await previewButtons[0].sendKeys(Key.ENTER);
    }

    let verifiedKanjiTypography = false;
    let verifiedKanjiFeedback = false;
    let verifiedActiveRecall = false;
    let verifiedKanjiReading = false;
    let verifiedSentenceCloze = false;
    let verifiedDelayedRetry = false;

    for (let index = 0; index < 60; index += 1) {
      await driver.wait(
        async () =>
          (await driver.findElements(By.css('.choice-button:not([disabled])'))).length > 0 ||
          (await driver.findElements(By.css('.text-input:not([disabled])'))).length > 0,
        timeoutMs,
      );
      const kanjiChoices = await driver.findElements(By.css('.japanese-kanji-choice'));
      const availableChoices = await driver.findElements(By.css('.choice-button:not([disabled])'));
      const inputFields = await driver.findElements(By.css('.text-input:not([disabled])'));
      const eyebrow = await driver.findElement(By.css('.lesson-card .eyebrow')).getText();

      if (eyebrow === 'Возврат к ошибке') {
        verifiedDelayedRetry = true;
      }

      if (availableChoices.length > 0 && kanjiChoices.length > 0) {
        const typographyMetrics = await driver.executeScript(
          `return [...document.querySelectorAll('.choice-button')].map((button) => ({
            hasKanji: /\\p{Script=Han}/u.test(button.textContent ?? ''),
            hasKana: /[\\u3040-\\u30ff]/.test(button.textContent ?? ''),
            fontSize: Number.parseFloat(getComputedStyle(button.querySelector('.choice-button-label')).fontSize),
            width: button.clientWidth,
            scrollWidth: button.scrollWidth,
            height: button.clientHeight,
            scrollHeight: button.scrollHeight,
          }));`,
        );
        assert.ok(
          typographyMetrics
            .filter((item) => item.hasKanji)
            .every((item) => item.fontSize >= 24 && item.scrollWidth <= item.width && item.scrollHeight <= item.height),
          'Kanji choice typography overflows its button',
        );
        const kanaOnlyMetrics = typographyMetrics.filter((item) => item.hasKana && !item.hasKanji);

        if (kanaOnlyMetrics.length > 0) {
          assert.ok(kanaOnlyMetrics.every((item) => item.fontSize < 24), 'Kana-only choice received enlarged kanji typography');
        }
        verifiedKanjiTypography = true;
      }

      if (availableChoices.length > 0) {
        await availableChoices[0].sendKeys(Key.ENTER);
      } else {
        assert.equal(inputFields.length, 1, 'Japanese exercise has no usable answer control');

        if (eyebrow === 'Активное вспоминание') {
          verifiedActiveRecall = true;
          assert.equal((await driver.findElements(By.css('.choice-button'))).length, 0, 'Active recall still exposes choices');
        }

        if (eyebrow === 'Чтение кандзи') {
          const readingMetrics = await driver.executeScript(
            `const prompt = document.querySelector('.lesson-kanji-reading-prompt');
             return prompt ? {
               fontSize: Number.parseFloat(getComputedStyle(prompt).fontSize),
               width: prompt.clientWidth,
               scrollWidth: prompt.scrollWidth,
             } : null;`,
          );
          assert.ok(readingMetrics?.fontSize >= 42, 'Kanji reading prompt is too small');
          assert.ok(readingMetrics.scrollWidth <= readingMetrics.width, 'Kanji reading prompt overflows');
          verifiedKanjiReading = true;
        }

        if (eyebrow === 'Слово в контексте') {
          const clozeText = await driver.findElement(By.css('.cloze-prompt')).getText();
          const clozeTranslation = await driver.findElement(By.css('.cloze-context')).getText();
          assert.ok(clozeText.includes('＿＿'), 'Sentence cloze has no visible gap');
          assert.ok(clozeTranslation.length > 0, 'Sentence cloze has no contextual translation');
          verifiedSentenceCloze = true;
        }

        await inputFields[0].sendKeys('неверный ответ');
        await driver.findElement(By.xpath('//button[normalize-space()="Проверить"]')).sendKeys(Key.ENTER);
      }

      await driver.wait(until.elementLocated(By.css('.answer-feedback-translation')), timeoutMs);
      const feedbackWord = await driver.findElement(By.css('.answer-feedback-word')).getText();

      if (/\p{Script=Han}/u.test(feedbackWord)) {
        const feedbackReading = await driver.findElement(By.css('.answer-feedback-reading')).getText();
        assert.ok(/[\u3040-\u309f]/.test(feedbackReading), 'Kanji answer has no hiragana reading');
        verifiedKanjiFeedback = true;
      }

      if (
        verifiedKanjiTypography &&
        verifiedKanjiFeedback &&
        verifiedActiveRecall &&
        verifiedKanjiReading &&
        verifiedSentenceCloze &&
        verifiedDelayedRetry
      ) break;
      const nextExerciseButton = await driver.findElement(By.xpath('//button[normalize-space()="Дальше"]'));
      await nextExerciseButton.sendKeys(Key.ENTER);
    }

    assert.ok(verifiedKanjiTypography, 'No kanji choice typography was verified');
    assert.ok(verifiedKanjiFeedback, 'No kanji answer feedback was verified');
    assert.ok(verifiedActiveRecall, 'Translation-to-word active recall was not verified');
    assert.ok(verifiedKanjiReading, 'Kanji-to-hiragana exercise was not verified');
    assert.ok(verifiedSentenceCloze, 'Sentence cloze exercise was not verified');
    assert.ok(verifiedDelayedRetry, 'A failed word did not return after intervening tasks');
    await driver.manage().window().setRect({ width: 375, height: 812, x: 0, y: 0 });
    const japaneseViewportMetrics = await driver.executeScript(
      `return {
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        exampleReadings: [...document.querySelectorAll('.japanese-example-reading')].map((item) => ({
          width: item.clientWidth,
          scrollWidth: item.scrollWidth,
        })),
        choices: [...document.querySelectorAll('.japanese-kanji-choice')].map((button) => ({
          width: button.clientWidth,
          scrollWidth: button.scrollWidth,
          height: button.clientHeight,
          scrollHeight: button.scrollHeight,
        })),
      };`,
    );
    assert.ok(japaneseViewportMetrics.scrollWidth <= japaneseViewportMetrics.width, 'Japanese exercise overflows the narrow viewport');
    assert.ok(
      japaneseViewportMetrics.exampleReadings.every((item) => item.scrollWidth <= item.width),
      'Japanese example reading overflows in the narrow viewport',
    );
    assert.ok(
      japaneseViewportMetrics.choices.every((item) => item.scrollWidth <= item.width && item.scrollHeight <= item.height),
      'Kanji choice overflows its button in the narrow viewport',
    );
    const closeJapaneseLessonButton = await driver.findElement(By.xpath('//button[@aria-label="Выйти из урока"]'));
    await closeJapaneseLessonButton.sendKeys(Key.ENTER);

    const statisticsButton = await findNavigationButton(driver, 'Прогресс');
    await statisticsButton.sendKeys(Key.ENTER);
    await driver.wait(until.elementLocated(By.css('.analytics-page')), timeoutMs);
    assert.equal((await driver.findElements(By.css('.analytics-kpi-icon svg'))).length, 4, 'Statistics icons are incomplete');

    console.log('Checking narrow viewport overflow...');
    const viewportMetrics = await driver.executeScript(
      'return { width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth };',
    );
    assert.ok(viewportMetrics.scrollWidth <= viewportMetrics.width, 'Horizontal page overflow detected');

    console.log(`Safari smoke test passed at ${baseUrl}`);
  } catch (error) {
    console.error('Safari smoke test failed.');
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

await main();

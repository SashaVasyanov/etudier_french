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

    console.log('Starting lesson...');
    const startLessonButton = await driver.findElement(By.xpath('//button[contains(., "Начать урок")]'));
    await startLessonButton.click();

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
    await choiceButtons[0].click();
    await driver.wait(until.elementLocated(By.css('.answer-feedback')), timeoutMs);
    await driver.wait(until.elementLocated(By.xpath('//button[normalize-space()="Прослушать ещё раз"]')), timeoutMs);

    console.log('Checking dictionary list limit...');
    const closeLessonButton = await driver.findElement(By.xpath('//button[@aria-label="Выйти из урока"]'));
    await closeLessonButton.click();
    const dictionaryButton = await findNavigationButton(driver, 'Словарь');
    await dictionaryButton.click();
    await driver.wait(until.elementLocated(By.css('.dictionary-grid')), timeoutMs);
    const renderedWordCards = await driver.findElements(By.css('.dictionary-grid > .word-card'));
    assert.ok(renderedWordCards.length > 0 && renderedWordCards.length <= 80, 'Dictionary rendered too many cards');

    console.log('Checking profile and statistics routes...');
    const profileButton = await findNavigationButton(driver, 'Профиль');
    await profileButton.click();
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
    await homeButton.click();
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Начать урок")]')), timeoutMs);
    assert.ok((await driver.findElement(By.css('.home-language-chip')).getText()).includes('JP'), 'Japanese home label is incorrect');
    await driver.findElement(By.xpath('//button[contains(., "Начать урок")]')).click();
    await driver.wait(until.elementLocated(By.xpath('//button[normalize-space()="Понял, дальше"]')), timeoutMs);
    const japaneseExampleTranslation = await driver.findElement(By.css('.lesson-preview-example-translation')).getText();
    assert.ok(!/^Слово «.+» часто используется\.$/.test(japaneseExampleTranslation), 'Japanese example was not translated');

    for (let index = 0; index < 20; index += 1) {
      const previewButtons = await driver.findElements(By.xpath('//button[normalize-space()="Понял, дальше"]'));

      if (previewButtons.length === 0) break;
      await previewButtons[0].sendKeys(Key.ENTER);
    }

    let verifiedKanjiTypography = false;
    let verifiedKanaTypography = false;
    let verifiedKanjiFeedback = false;

    for (let index = 0; index < 14; index += 1) {
      await driver.wait(until.elementLocated(By.css('.choice-button')), timeoutMs);
      const kanjiChoices = await driver.findElements(By.css('.japanese-kanji-choice'));
      const availableChoices = await driver.findElements(By.css('.choice-button:not([disabled])'));
      assert.ok(availableChoices.length > 0, 'Japanese exercise has no available choices');

      if (kanjiChoices.length > 0) {
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
          verifiedKanaTypography = true;
        }
        verifiedKanjiTypography = true;
      }

      await availableChoices[0].click();
      await driver.wait(until.elementLocated(By.css('.answer-feedback-translation')), timeoutMs);
      const feedbackWord = await driver.findElement(By.css('.answer-feedback-word')).getText();

      if (/\p{Script=Han}/u.test(feedbackWord)) {
        const feedbackReading = await driver.findElement(By.css('.answer-feedback-reading')).getText();
        assert.ok(/[\u3040-\u309f]/.test(feedbackReading), 'Kanji answer has no hiragana reading');
        verifiedKanjiFeedback = true;
      }

      if (verifiedKanjiTypography && verifiedKanjiFeedback) break;
      const nextExerciseButton = await driver.findElement(By.xpath('//button[normalize-space()="Дальше"]'));
      await nextExerciseButton.click();
    }

    assert.ok(verifiedKanjiTypography, 'No kanji choice typography was verified');
    assert.ok(verifiedKanaTypography, 'No kana-only choice typography was verified');
    assert.ok(verifiedKanjiFeedback, 'No kanji answer feedback was verified');
    await driver.manage().window().setRect({ width: 375, height: 812, x: 0, y: 0 });
    const japaneseViewportMetrics = await driver.executeScript(
      `return {
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
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
      japaneseViewportMetrics.choices.every((item) => item.scrollWidth <= item.width && item.scrollHeight <= item.height),
      'Kanji choice overflows its button in the narrow viewport',
    );
    const closeJapaneseLessonButton = await driver.findElement(By.xpath('//button[@aria-label="Выйти из урока"]'));
    await closeJapaneseLessonButton.click();

    const statisticsButton = await findNavigationButton(driver, 'Прогресс');
    await statisticsButton.click();
    await driver.wait(until.elementLocated(By.css('.analytics-page')), timeoutMs);

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

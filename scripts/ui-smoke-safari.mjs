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
    const statisticsButton = await findNavigationButton(driver, 'Прогресс');
    await statisticsButton.click();
    await driver.wait(until.elementLocated(By.css('.analytics-page')), timeoutMs);

    console.log('Checking narrow viewport overflow...');
    await driver.manage().window().setRect({ width: 375, height: 812, x: 0, y: 0 });
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

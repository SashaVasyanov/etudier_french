import { Builder, By, Key, until } from 'selenium-webdriver';

const baseUrl = process.env.UI_BASE_URL ?? 'http://127.0.0.1:4173';
const storageKey = 'anki-plus-storage';
const timeoutMs = 15000;

async function findByText(driver, tagName, text) {
  return driver.findElement(
    By.xpath(`//${tagName}[normalize-space()="${text}"]`),
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

    console.log(`Opening ${baseUrl}...`);
    await driver.get(baseUrl);
    console.log('Resetting local storage...');
    await driver.executeScript(`window.localStorage.removeItem("${storageKey}")`);
    await driver.navigate().refresh();

    console.log('Waiting for app shell...');
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Стартовать ежедневный урок")]')), timeoutMs);

    console.log('Starting lesson...');
    const startLessonButton = await findByText(driver, 'button', 'Стартовать ежедневный урок');
    await startLessonButton.click();

    console.log('Waiting for flashcard...');
    await driver.wait(until.elementLocated(By.xpath('//*[contains(., "Карточка слова")]')), timeoutMs);
    await driver.wait(until.elementLocated(By.xpath('//button[contains(., "Показать перевод")]')), timeoutMs);

    console.log('Revealing translation...');
    const revealButton = await findByText(driver, 'button', 'Показать перевод');
    await revealButton.click();

    await driver.wait(until.elementLocated(By.xpath('//*[contains(., "Перевод")]')), timeoutMs);

    console.log('Moving to next step...');
    const nextButton = await findByText(driver, 'button', 'Дальше');
    await nextButton.sendKeys(Key.ENTER);

    console.log(`Safari smoke test passed at ${baseUrl}`);
  } catch (error) {
    console.error('Safari smoke test failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

await main();

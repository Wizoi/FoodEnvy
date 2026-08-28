import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => consoleMessages.push(msg.text()));
  page.on('pageerror', err => errors.push(err.message));

  try {
    await page.goto('http://localhost:8000/recipe-browser.html', { waitUntil: 'networkidle', timeout: 10000 });
  } catch (e) {
    console.log('GOTO ERROR:', e.message);
  }

  await page.waitForTimeout(3000);

  const content = await page.evaluate(() => {
    return {
      title: document.title,
      loadingMsg: document.getElementById('loadingMsg')?.textContent,
      loadingVisible: document.getElementById('loadingMsg')?.offsetParent !== null,
      gridVisible: document.getElementById('recipeGrid')?.offsetParent !== null,
      recipeCount: document.querySelectorAll('.recipe-card').length,
      allRecipesLength: window.allRecipes?.length || 0,
      profiles: window.profiles?.length || 0
    };
  });

  console.log('CONSOLE MESSAGES:', consoleMessages);
  console.log('ERRORS:', errors);
  console.log('PAGE STATE:', JSON.stringify(content, null, 2));

  await browser.close();
})();

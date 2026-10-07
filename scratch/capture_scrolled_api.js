const puppeteer = require('puppeteer');
const path = require('path');

const artifactDir = 'C:/Users/A/.gemini/antigravity-ide/brain/c5453988-3c74-4e77-acd3-94d825a51325';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1920,1080', '--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('http://localhost:3000/user.html', { waitUntil: 'networkidle0' });

  // Handle login if present
  const loginVisible = await page.$eval('#userLoginForm', el => !el.classList.contains('hidden')).catch(() => false);
  if (loginVisible) {
    await page.type('#userLoginUsername', 'yash_test');
    await page.type('#userLoginPassword', 'password123');
    await page.click('#userLoginForm button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Force show dashboard and go to apiDocsTab
  await page.evaluate(() => {
    document.getElementById('userAuth')?.classList.add('hidden');
    document.getElementById('userConnectScreen')?.classList.add('hidden');
    document.getElementById('userDashboard')?.classList.remove('hidden');
    document.querySelector('[data-user-tab="apiDocsTab"]')?.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Perform mouse wheel scroll
  await page.mouse.move(700, 500);
  await page.mouse.wheel({ deltaY: 600 });
  await new Promise(r => setTimeout(r, 1000));

  const scrollPos = await page.evaluate(() => {
    return document.querySelector('.workspace-main-panel').scrollTop;
  });
  console.log('Main panel scroll position:', scrollPos);

  const shot = path.join(artifactDir, 'verified_api_docs_scrolled.png');
  await page.screenshot({ path: shot, fullPage: false });
  console.log('Saved scrolled API Docs screenshot:', shot);

  await browser.close();
})();

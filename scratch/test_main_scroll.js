const puppeteer = require('puppeteer');

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

  await page.evaluate(() => {
    document.getElementById('userAuth')?.classList.add('hidden');
    document.getElementById('userConnectScreen')?.classList.add('hidden');
    document.getElementById('userDashboard')?.classList.remove('hidden');
    document.querySelector('[data-user-tab="apiDocsTab"]')?.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const res = await page.evaluate(() => {
    const main = document.querySelector('.workspace-main-panel');
    const before = main.scrollTop;
    main.scrollTop = 500;
    return {
      before,
      after: main.scrollTop,
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
      diff: main.scrollHeight - main.clientHeight
    };
  });

  console.log('Scroll result:', res);

  // Also test with page.mouse.wheel
  await page.mouse.move(500, 500);
  await page.mouse.wheel({ deltaY: 300 });
  await new Promise(r => setTimeout(r, 500));

  const afterWheel = await page.evaluate(() => {
    return document.querySelector('.workspace-main-panel').scrollTop;
  });
  console.log('After mouse wheel:', afterWheel);

  await browser.close();
})();

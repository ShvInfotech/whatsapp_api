const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1920,1080', '--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto('http://localhost:3000/user.html', { waitUntil: 'networkidle0' });

  // Login if present
  const loginVisible = await page.$eval('#userLoginForm', el => !el.classList.contains('hidden')).catch(() => false);
  if (loginVisible) {
    await page.type('#userLoginUsername', 'yash_test');
    await page.type('#userLoginPassword', 'password123');
    await page.click('#userLoginForm button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Force show dashboard
  await page.evaluate(() => {
    document.getElementById('userAuth')?.classList.add('hidden');
    document.getElementById('userConnectScreen')?.classList.add('hidden');
    document.getElementById('userDashboard')?.classList.remove('hidden');
    document.querySelector('[data-user-tab="apiDocsTab"]')?.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const debug = await page.evaluate(() => {
    const main = document.querySelector('.workspace-main-panel');
    const layout = document.querySelector('.user-workspace-layout');
    const tab = document.getElementById('apiDocsTab');
    const body = document.body;
    const html = document.documentElement;

    const mainCS = window.getComputedStyle(main);
    const layoutCS = window.getComputedStyle(layout);
    const bodyCS = window.getComputedStyle(body);
    const htmlCS = window.getComputedStyle(html);

    return {
      main: {
        clientHeight: main.clientHeight,
        scrollHeight: main.scrollHeight,
        offsetHeight: main.offsetHeight,
        overflowY: mainCS.overflowY,
        height: mainCS.height,
        maxHeight: mainCS.maxHeight,
        scrollTop: main.scrollTop
      },
      layout: {
        clientHeight: layout.clientHeight,
        scrollHeight: layout.scrollHeight,
        offsetHeight: layout.offsetHeight,
        overflowY: layoutCS.overflowY,
        height: layoutCS.height,
        maxHeight: layoutCS.maxHeight
      },
      body: {
        clientHeight: body.clientHeight,
        scrollHeight: body.scrollHeight,
        overflowY: bodyCS.overflowY,
        scrollTop: window.scrollY
      }
    };
  });

  console.log('Debug info:', JSON.stringify(debug, null, 2));

  // Try scrolling via window
  const windowScroll = await page.evaluate(() => {
    window.scrollTo(0, 500);
    return window.scrollY;
  });
  console.log('Window scroll Y after window.scrollTo(0, 500):', windowScroll);

  // Try scrolling layout
  const layoutScroll = await page.evaluate(() => {
    const l = document.querySelector('.user-workspace-layout');
    l.scrollTop = 500;
    return l.scrollTop;
  });
  console.log('Layout scroll top:', layoutScroll);

  // Try scrolling tab panel
  const tabScroll = await page.evaluate(() => {
    const t = document.getElementById('apiDocsTab');
    t.scrollTop = 500;
    return t.scrollTop;
  });
  console.log('Tab scroll top:', tabScroll);

  await browser.close();
})();

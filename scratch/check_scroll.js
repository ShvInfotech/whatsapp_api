const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('http://localhost:3000/user.html', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // Fill login if visible
    const authState = await page.evaluate(() => {
      const auth = document.getElementById('userAuthScreen');
      const dash = document.getElementById('userDashboard');
      return {
        authHidden: auth ? auth.classList.contains('hidden') : null,
        dashHidden: dash ? dash.classList.contains('hidden') : null,
        token: localStorage.getItem('token')
      };
    });
    console.log('Initial Auth state:', authState);

    if (!authState.authHidden) {
      await page.type('#userAuthUser', 'yash_test');
      await page.type('#userAuthPass', 'password123');
      await page.click('#btnUserLogin');
      await new Promise(r => setTimeout(r, 2500));
    }

    const stateAfterLogin = await page.evaluate(() => {
      const auth = document.getElementById('userAuthScreen');
      const dash = document.getElementById('userDashboard');
      return {
        authHidden: auth ? auth.classList.contains('hidden') : null,
        dashHidden: dash ? dash.classList.contains('hidden') : null,
        token: localStorage.getItem('token')
      };
    });
    console.log('After Login state:', stateAfterLogin);

    // Switch to apiDocsTab
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-user-tab="apiDocsTab"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const check = await page.evaluate(() => {
      const main = document.querySelector('.workspace-main-panel');
      const activeTab = document.querySelector('.user-tab-panel.active');
      const layout = document.querySelector('.user-workspace-layout');
      const body = document.body;
      const html = document.documentElement;

      return {
        activeTabId: activeTab ? activeTab.id : null,
        activeTabHeight: activeTab ? activeTab.getBoundingClientRect().height : 0,
        mainHeight: main ? main.getBoundingClientRect().height : 0,
        mainScrollHeight: main ? main.scrollHeight : 0,
        mainClientHeight: main ? main.clientHeight : 0,
        bodyScrollHeight: body.scrollHeight,
        windowInnerHeight: window.innerHeight,
        htmlOverflow: window.getComputedStyle(html).overflow,
        bodyOverflow: window.getComputedStyle(body).overflow,
        mainOverflowY: main ? window.getComputedStyle(main).overflowY : null,
        mainOverflowX: main ? window.getComputedStyle(main).overflowX : null,
      };
    });
    console.log('Detailed Check:', check);

    await browser.close();
  } catch (err) {
    console.error('Error during scroll check:', err);
  }
})();

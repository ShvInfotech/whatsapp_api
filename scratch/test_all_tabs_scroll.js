const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--window-size=1920,1080', '--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('http://localhost:3000/user.html', { waitUntil: 'networkidle0' });

    // Login if visible
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
    });
    await new Promise(r => setTimeout(r, 1000));

    // List all tabs and check their heights and scrollability
    const tabs = ['myDeviceTab', 'singleMessageTab', 'bulkMessageTab', 'templatesTab', 'logsTab', 'apiDocsTab', 'plansTab', 'settingsTab'];

    for (const tab of tabs) {
      await page.evaluate((t) => {
        document.querySelectorAll('.user-tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
        const panel = document.getElementById(t);
        if (panel) panel.classList.add('active');
        const btn = document.querySelector(`[data-user-tab="${t}"]`);
        if (btn) btn.classList.add('active');
      }, tab);

      await new Promise(r => setTimeout(r, 500));

      const tabInfo = await page.evaluate((t) => {
        const panel = document.getElementById(t);
        const main = document.querySelector('.workspace-main-panel');
        const layout = document.querySelector('.user-workspace-layout');
        const body = document.body;
        const html = document.documentElement;

        const mainRect = main.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();

        return {
          tab: t,
          panelHeight: panelRect.height,
          mainClientHeight: main.clientHeight,
          mainScrollHeight: main.scrollHeight,
          windowHeight: window.innerHeight,
          bodyScrollHeight: body.scrollHeight,
          canScrollMain: main.scrollHeight > main.clientHeight,
          canScrollWindow: body.scrollHeight > window.innerHeight
        };
      }, tab);

      console.log(`Tab: ${tab}:`, tabInfo);
    }

    await browser.close();
  } catch (err) {
    console.error('Test error:', err);
    await browser.close();
  }
})();

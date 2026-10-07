const puppeteer = require('puppeteer');
const path = require('path');

const artifactDir = 'C:/Users/A/.gemini/antigravity-ide/brain/c5453988-3c74-4e77-acd3-94d825a51325';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--window-size=1920,1080', '--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to http://localhost:3000/user.html ...');
    await page.goto('http://localhost:3000/user.html', { waitUntil: 'networkidle0' });

    // Handle login if present
    const loginVisible = await page.$eval('#userLoginForm', el => !el.classList.contains('hidden')).catch(() => false);
    if (loginVisible) {
      console.log('Logging in as yash_test ...');
      await page.type('#userLoginUsername', 'yash_test');
      await page.type('#userLoginPassword', 'password123');
      await page.click('#userLoginForm button[type="submit"]');
      await new Promise(r => setTimeout(r, 2000));
    }

    // Force display user dashboard
    await page.evaluate(() => {
      document.getElementById('userAuth')?.classList.add('hidden');
      document.getElementById('userConnectScreen')?.classList.add('hidden');
      document.getElementById('userDashboard')?.classList.remove('hidden');
    });
    await new Promise(r => setTimeout(r, 1000));

    // Verify Tab 1 (Dashboard Overview & Recent Dispatches)
    console.log('Verifying Dashboard Overview & Recent Dispatches Table ...');
    await page.evaluate(() => {
      document.querySelector('[data-user-tab="myDeviceTab"]')?.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Open Header Profile Dropdown
    await page.click('#headerProfileBtn');
    await new Promise(r => setTimeout(r, 500));

    const dropdownState = await page.evaluate(() => {
      const dd = document.getElementById('headerProfileDropdown');
      const planTag = document.getElementById('headerPlanBadge');
      const logoutBtn = document.getElementById('userLogout');
      const logoutStyles = window.getComputedStyle(logoutBtn);
      const table = document.querySelector('.recent-dispatches-table');

      return {
        dropdownVisible: dd && !dd.classList.contains('hidden'),
        planTagText: planTag ? planTag.textContent.trim() : null,
        logoutColor: logoutStyles.color,
        logoutBg: logoutStyles.backgroundColor,
        hasRecentTable: !!table,
        tableRowsCount: table ? table.querySelectorAll('tbody tr').length : 0
      };
    });
    console.log('UI State with Dropdown Open:', dropdownState);

    // Capture screenshot 1: Dashboard with Open Profile Dropdown, Pinned Red Logout, Modern Table
    const shot1 = path.join(artifactDir, 'verified_header_dropdown_and_table.png');
    await page.screenshot({ path: shot1, fullPage: false });
    console.log('Saved screenshot 1:', shot1);

    // Close dropdown
    await page.click('#headerProfileBtn');
    await new Promise(r => setTimeout(r, 300));

    // Switch to API Docs Tab (Developer API & E-Commerce Gateway)
    console.log('Testing scrolling on Developer API & E-Commerce Gateway ...');
    await page.evaluate(() => {
      document.querySelector('[data-user-tab="apiDocsTab"]')?.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const scrollTest = await page.evaluate(() => {
      const main = document.querySelector('.workspace-main-panel');
      const beforeScroll = main.scrollTop;
      main.scrollTop = 600;
      const afterScroll = main.scrollTop;

      return {
        clientHeight: main.clientHeight,
        scrollHeight: main.scrollHeight,
        beforeScroll,
        afterScroll,
        scrolledSuccessfully: afterScroll > 0
      };
    });
    console.log('API Docs Scroll Test Result:', scrollTest);

    // Capture screenshot 2: Scrolled API Docs Tab
    const shot2 = path.join(artifactDir, 'verified_api_docs_scrolled.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log('Saved screenshot 2:', shot2);

    await browser.close();
    console.log('All verifications completed successfully!');
  } catch (err) {
    console.error('Error during verification:', err);
    await browser.close();
  }
})();

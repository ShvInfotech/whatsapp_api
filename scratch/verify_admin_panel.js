const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = path.resolve('C:\\Users\\A\\.gemini\\antigravity-ide\\brain\\c5453988-3c74-4e77-acd3-94d825a51325');

(async () => {
  let browser;
  try {
    console.log('Launching browser to verify Admin Console...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // 1. Open admin.html
    console.log('Navigating to http://localhost:3000/admin.html...');
    await page.goto('http://localhost:3000/admin.html', { waitUntil: 'networkidle2' });

    // Check if on login screen
    const loginVisible = await page.$eval('#loginScreen', el => !el.classList.contains('hidden'));
    console.log('Login screen visible:', loginVisible);

    if (loginVisible) {
      console.log('Entering admin credentials...');
      await page.click('#loginUsername', { clickCount: 3 });
      await page.type('#loginUsername', 'admin');
      await page.click('#loginPassword', { clickCount: 3 });
      await page.type('#loginPassword', 'admin123');
      await page.click('#loginButton');

      // Wait for authentication success
      await page.waitForFunction(() => !document.body.classList.contains('auth-required'), { timeout: 8000 });
      console.log('Authenticated successfully!');
      await new Promise(r => setTimeout(r, 2000));
    }

    // Verify authenticated state
    const bodyClass = await page.$eval('body', el => el.className);
    console.log('Body classes after login:', bodyClass);

    // 2. Capture Dashboard Tab
    console.log('Capturing Dashboard Overview tab...');
    await page.waitForSelector('#kpiTotalUsers', { timeout: 8000 });
    await new Promise(r => setTimeout(r, 1000));

    const totalUsers = await page.$eval('#kpiTotalUsers', el => el.textContent);
    const totalRevenue = await page.$eval('#kpiTotalRevenue', el => el.textContent);
    const connectedSessions = await page.$eval('#kpiConnectedSessions', el => el.textContent);
    console.log(`KPIs -> Users: ${totalUsers}, Revenue: ${totalRevenue}, Connected Sessions: ${connectedSessions}`);

    const dashPath = path.join(ARTIFACT_DIR, 'admin_dashboard_overview.png');
    await page.screenshot({ path: dashPath });
    console.log('Saved dashboard screenshot:', dashPath);

    // 3. Switch to User Management Tab
    console.log('Switching to Users Tab...');
    await page.click('.admin-nav-item[data-tab="usersTab"]');
    await new Promise(r => setTimeout(r, 1500));
    const userRows = await page.$$eval('#adminUsersTableBody tr', trs => trs.length);
    console.log('Rendered user rows count:', userRows);

    const usersPath = path.join(ARTIFACT_DIR, 'admin_users_management.png');
    await page.screenshot({ path: usersPath });
    console.log('Saved users screenshot:', usersPath);

    // 4. Test Top-Up Modal
    console.log('Testing Top-Up Modal...');
    const topupBtn = await page.$('button[data-user-action="topup"]');
    if (topupBtn) {
      await topupBtn.click();
      await new Promise(r => setTimeout(r, 800));
      const topupVisible = await page.$eval('#topupCreditsModal', el => !el.classList.contains('hidden'));
      console.log('Topup modal visible:', topupVisible);

      const modalPath = path.join(ARTIFACT_DIR, 'admin_topup_modal.png');
      await page.screenshot({ path: modalPath });
      console.log('Saved topup modal screenshot:', modalPath);

      // Close modal
      await page.click('#btnCloseTopupModal');
      await new Promise(r => setTimeout(r, 500));
    }

    // 5. Switch to Billing Tab
    console.log('Switching to Billing Tab...');
    await page.click('.admin-nav-item[data-tab="billingTab"]');
    await new Promise(r => setTimeout(r, 1500));
    const txRows = await page.$$eval('#adminTransactionsTableBody tr', trs => trs.length);
    console.log('Rendered transaction rows count:', txRows);

    const billingPath = path.join(ARTIFACT_DIR, 'admin_billing_transactions.png');
    await page.screenshot({ path: billingPath });
    console.log('Saved billing screenshot:', billingPath);

    // 6. Switch to WhatsApp Instances Tab
    console.log('Switching to Instances Tab...');
    await page.click('.admin-nav-item[data-tab="instancesTab"]');
    await new Promise(r => setTimeout(r, 1500));
    const instCards = await page.$$eval('.instance-card', cards => cards.length);
    console.log('Rendered instance cards count:', instCards);

    const instPath = path.join(ARTIFACT_DIR, 'admin_instances_monitor.png');
    await page.screenshot({ path: instPath });
    console.log('Saved instances screenshot:', instPath);

    // 7. Switch to Plans Tab
    console.log('Switching to Plans Tab...');
    await page.click('.admin-nav-item[data-tab="plansTab"]');
    await new Promise(r => setTimeout(r, 1000));

    const plansPath = path.join(ARTIFACT_DIR, 'admin_plans_pricing.png');
    await page.screenshot({ path: plansPath });
    console.log('Saved plans screenshot:', plansPath);

    // 8. Open Admin Profile Dropdown in Header
    console.log('Opening Admin Profile Dropdown...');
    await page.click('#adminProfileBtn');
    await new Promise(r => setTimeout(r, 600));

    const dropdownPath = path.join(ARTIFACT_DIR, 'admin_header_dropdown.png');
    await page.screenshot({ path: dropdownPath });
    console.log('Saved admin header dropdown screenshot:', dropdownPath);

    console.log('--- ALL ADMIN CONSOLE VERIFICATIONS COMPLETED SUCCESSFULLY! ---');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during admin verification:', err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();

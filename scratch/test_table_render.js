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

  // Force show dashboard & mock sample dispatches to verify styling
  await page.evaluate(() => {
    document.getElementById('userAuth')?.classList.add('hidden');
    document.getElementById('userConnectScreen')?.classList.add('hidden');
    document.getElementById('userDashboard')?.classList.remove('hidden');
    document.querySelector('[data-user-tab="myDeviceTab"]')?.click();

    const tbody = document.getElementById('dashRecentLogsBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td class="dispatch-time-cell">05:40 PM</td>
          <td>
            <span class="dispatch-recipient-badge">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              +919714920969
            </span>
          </td>
          <td><span class="dispatch-type-badge">single</span></td>
          <td><div class="dispatch-msg-snippet">Test Message For Delay Check and Anti-Ban protection...</div></td>
          <td>
            <span class="dispatch-status-pill sent">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Sent
            </span>
          </td>
        </tr>
        <tr>
          <td class="dispatch-time-cell">05:40 PM</td>
          <td>
            <span class="dispatch-recipient-badge">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              +918140349408
            </span>
          </td>
          <td><span class="dispatch-type-badge">bulk</span></td>
          <td><div class="dispatch-msg-snippet">Festival discount campaign order receipt #1042</div></td>
          <td>
            <span class="dispatch-status-pill sent">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Sent
            </span>
          </td>
        </tr>
        <tr>
          <td class="dispatch-time-cell">05:38 PM</td>
          <td>
            <span class="dispatch-recipient-badge">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              +919988776655
            </span>
          </td>
          <td><span class="dispatch-type-badge">template</span></td>
          <td><div class="dispatch-msg-snippet">OTP verification code 482910 for login</div></td>
          <td>
            <span class="dispatch-status-pill failed">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Failed
            </span>
          </td>
        </tr>
      `;
    }
  });

  await new Promise(r => setTimeout(r, 600));

  const shot = path.join(artifactDir, 'verified_recent_dispatches_table_populated.png');
  await page.screenshot({ path: shot, fullPage: false });
  console.log('Saved populated dispatches table screenshot:', shot);

  await browser.close();
})();

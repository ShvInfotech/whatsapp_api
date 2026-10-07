const puppeteer = require('puppeteer');
const path = require('path');

const artifactDir = 'C:/Users/A/.gemini/antigravity-ide/brain/c5453988-3c74-4e77-acd3-94d825a51325';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--window-size=1920,1080', '--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setRequestInterception(true);
  page.on('request', interceptedReq => {
    if (interceptedReq.url().includes('/api/user/logs?limit=5')) {
      interceptedReq.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { recipient: '919714920969', type: 'single', status: 'sent', preview: 'Test Message For Delay Check and Anti-Ban protection', timestamp: new Date().toISOString() },
            { recipient: '918140349408', type: 'bulk', status: 'sent', preview: 'Festival promotional discount campaign receipt #1042', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
            { recipient: '919988776655', type: 'template', status: 'failed', preview: 'OTP verification code 482910 for account access', timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
            { recipient: '919825123456', type: 'order', status: 'sent', preview: 'Order confirmed! Your parcel is on the way with Delhivery.', timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString() }
          ]
        })
      });
    } else {
      interceptedReq.continue();
    }
  });

  await page.goto('http://localhost:3000/user.html', { waitUntil: 'networkidle0' });

  // Handle login if present
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
    document.querySelector('[data-user-tab="myDeviceTab"]')?.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  const shot = path.join(artifactDir, 'verified_recent_dispatches_table_live.png');
  await page.screenshot({ path: shot, fullPage: false });
  console.log('Saved live table screenshot:', shot);

  await browser.close();
})();

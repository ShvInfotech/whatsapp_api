const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:/Users/A/.gemini/antigravity-ide/brain/c5453988-3c74-4e77-acd3-94d825a51325';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('--- Starting Connect WhatsApp & Skip Flow Verification ---');

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Create a fresh test user who is not connected
  const testUsername = `user_${Date.now()}`;
  const testPassword = 'Password123!';
  console.log(`Registering fresh disconnected user: ${testUsername}...`);

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });

  // Switch to Register tab
  await page.click('button.auth-link-btn');
  await wait(500);

  // Fill in registration form
  await page.type('#regFullName', 'Dev Flow Tester');
  await page.type('#regUsername', testUsername);
  await page.type('#regEmail', `${testUsername}@example.com`);
  await page.type('#regPassword', testPassword);

  // Click Submit
  await page.evaluate(() => {
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  console.log('Submitted registration, waiting for onboarding pairing screen...');
  await wait(4000);

  // Check current URL and DOM
  const url = page.url();
  console.log('Current URL after registration:', url);

  // Take screenshot of the Connect WhatsApp screen with live QR / Loading frame
  const connectScreenPath = path.join(ARTIFACTS_DIR, 'react_user_connect_qr_screen.png');
  await page.screenshot({ path: connectScreenPath, fullPage: true });
  console.log('Saved Connect screen screenshot to:', connectScreenPath);

  // Verify elements on Connect screen
  const pageContent = await page.content();
  const hasLinkTitle = pageContent.includes('Link Your WhatsApp to Continue');
  const hasSkipBtn = pageContent.includes('Skip for Now') || pageContent.includes('Skip to Dashboard');
  const hasStep1 = pageContent.includes('Open WhatsApp');
  console.log('Has Link Title:', hasLinkTitle);
  console.log('Has Skip Button:', hasSkipBtn);
  console.log('Has Steps:', hasStep1);

  // Click "Skip for Now" button
  console.log('Clicking "Skip for Now" button to bypass pairing...');
  const clickedSkip = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const skipBtn = btns.find(b => b.textContent.includes('Skip for Now') || b.textContent.includes('Skip to Dashboard'));
    if (skipBtn) {
      skipBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Skip:', clickedSkip);
  await wait(2000);

  // Verify main dashboard is now rendered
  const dashboardContent = await page.content();
  const hasDisconnectedBanner = dashboardContent.includes('WhatsApp Device Disconnected');
  const hasSingleMessageNav = dashboardContent.includes('Single Message');
  console.log('Has Disconnected Banner on Dashboard:', hasDisconnectedBanner);
  console.log('Has Main Navigation on Dashboard:', hasSingleMessageNav);

  const skippedDashboardPath = path.join(ARTIFACTS_DIR, 'react_user_connect_skipped_dashboard.png');
  await page.screenshot({ path: skippedDashboardPath, fullPage: true });
  console.log('Saved Skipped Dashboard screenshot to:', skippedDashboardPath);

  // Now click "Connect WhatsApp Now" on the banner
  console.log('Testing "Connect WhatsApp Now" button on banner...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const connectBtn = btns.find(b => b.textContent.includes('Connect WhatsApp Now'));
    if (connectBtn) connectBtn.click();
  });
  await wait(1500);

  const returnedToConnect = await page.evaluate(() => {
    return document.body.innerText.includes('Link Your WhatsApp to Continue');
  });
  console.log('Successfully returned to Connect screen:', returnedToConnect);

  await browser.close();
  console.log('--- Verification Complete! ---');
})();

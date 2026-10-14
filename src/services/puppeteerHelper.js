/**
 * Puppeteer stability helper for WhatsApp Web (whatsapp-web.js)
 * Prevents "Attempted to use detached Frame" and "Execution context was destroyed" errors.
 */

const DEFAULT_PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-default-apps',
  '--mute-audio',
  // Critical flags to prevent detached Frame and execution context destruction:
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-site-isolation-trials',
  '--disable-web-security',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-ipc-flooding-protection',
  '--disable-breakpad',
  '--disable-component-update',
  '--disable-domain-reliability',
  '--disable-sync',
  '--js-flags=--max-old-space-size=512',
  '--renderer-process-limit=2'
];

/**
 * Checks whether an error is caused by a detached or destroyed Puppeteer frame/context
 */
function isDetachedFrameError(err) {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('detached frame') ||
    msg.includes('execution context was destroyed') ||
    msg.includes('frame was detached') ||
    msg.includes('cannot find context with specified id') ||
    msg.includes('protocol error (runtime.callfunctionon)') ||
    msg.includes('target closed') ||
    msg.includes('navigation failed because browser has disconnected')
  );
}

/**
 * Ensures the Puppeteer page is healthy, main frame is attached, and WWebJS is injected
 */
async function ensurePageHealthyAndReady(client) {
  if (!client) return false;

  // Verify browser connectivity
  if (client.pupBrowser && typeof client.pupBrowser.isConnected === 'function') {
    if (!client.pupBrowser.isConnected()) {
      return false;
    }
  }

  // Verify page existence and open state
  if (!client.pupPage || client.pupPage.isClosed()) {
    return false;
  }

  try {
    // 1. Access document.readyState in the active main frame to force Puppeteer to re-bind
    await client.pupPage.evaluate(() => document.readyState).catch(() => null);

    // 2. Check if window.WWebJS exists in the current frame context; if not, re-inject
    const hasWWebJS = await client.pupPage.evaluate(() => typeof window.WWebJS !== 'undefined').catch(() => false);
    if (!hasWWebJS) {
      try {
        const { LoadUtils } = require('whatsapp-web.js/src/util/Injected/Utils');
        if (typeof LoadUtils === 'function') {
          await client.pupPage.evaluate(LoadUtils).catch(() => {});
        }
      } catch (_) {}
    }
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Executes an asynchronous function with automatic retries if a detached frame error occurs
 */
async function executeWithFrameRetry(fn, client, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const initialDelay = options.initialDelay || 1000;
  const logPrefix = options.logPrefix || '[PuppeteerFrame]';

  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isDetachedFrameError(err) && attempt < maxRetries) {
        const waitTime = initialDelay * attempt;
        console.warn(`${logPrefix} Detached Frame detected (${err.message}). Stabilizing and retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, waitTime));
        if (client) {
          await ensurePageHealthyAndReady(client);
        }
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

module.exports = {
  DEFAULT_PUPPETEER_ARGS,
  isDetachedFrameError,
  ensurePageHealthyAndReady,
  executeWithFrameRetry
};

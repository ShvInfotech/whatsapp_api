const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

function resolveChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const potentialPaths = [];

  if (process.platform === 'win32') {
    potentialPaths.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (process.platform === 'linux') {
    potentialPaths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  } else if (process.platform === 'darwin') {
    potentialPaths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    );
  }

  for (const candidate of potentialPaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || null,
  sessionId: process.env.SESSION_ID || 'safevault-session',
  rateLimitMinDelayMs: parseInt(process.env.RATE_LIMIT_MIN_DELAY_MS || '2500', 10),
  rateLimitMaxDelayMs: parseInt(process.env.RATE_LIMIT_MAX_DELAY_MS || '4500', 10),
  headless: process.env.HEADLESS !== 'false',
  authDataPath: path.resolve(__dirname, '../.wwebjs_auth'),
  adminDataPath: path.resolve(__dirname, '../data/admin.json'),
  instancesDataPath: path.resolve(__dirname, '../data/instances.json'),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  mongoDbName: process.env.MONGODB_DB_NAME || 'safevault_whatsapp',
  chromePath: resolveChromePath()
};

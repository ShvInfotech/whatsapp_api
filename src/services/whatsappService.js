const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const config = require('../config');
const { buildMessageMedia } = require('./mediaService');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.status = 'INITIALIZING'; // INITIALIZING, QR_READY, AUTHENTICATING, CONNECTED, DISCONNECTED, AUTH_FAILURE
    this.qrCodeRaw = null;
    this.qrCodeDataUrl = null;
    this.clientInfo = null;
    this.lastConnectedAt = null;
    this.lastDisconnectedAt = null;
    this.resetPromise = null;
    this.initializationPromise = null;
    this.lifecycleVersion = 0;
    this.sessionId = config.sessionId;
  }

  /**
   * Initialize WhatsApp Web Client with LocalAuth session persistence
   */
  initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    const version = this.lifecycleVersion;
    const initialization = this.initializeClient(version);
    this.initializationPromise = initialization;
    initialization.then(
      () => {
        if (this.initializationPromise === initialization) this.initializationPromise = null;
      },
      () => {
        if (this.initializationPromise === initialization) this.initializationPromise = null;
      }
    );
    return initialization;
  }

  async initializeClient(version) {
    console.log('[WhatsAppService] Initializing WhatsApp Client...');
    this.status = 'INITIALIZING';

    const puppeteerOptions = {
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };

    if (config.chromePath) {
      console.log(`[WhatsAppService] Using Chrome browser executable at: ${config.chromePath}`);
      puppeteerOptions.executablePath = config.chromePath;
    }

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.sessionId,
        dataPath: config.authDataPath
      }),
      puppeteer: puppeteerOptions
    });
    this.client = client;

    this.registerEvents(client, version);

    // Clean up stale lockfile or orphaned Chrome on Windows if exists
    try {
      const fs = require('fs');
      const lockfilePath = path.join(config.authDataPath, `session-${this.sessionId}`, 'lockfile');
      if (fs.existsSync(lockfilePath)) {
        try {
          fs.unlinkSync(lockfilePath);
          console.log('[WhatsAppService] Removed stale lockfile before initialization.');
        } catch (lockErr) {
          console.warn('[WhatsAppService] Lockfile is busy, terminating orphaned Chrome...');
          if (process.platform === 'win32') {
            try {
              require('child_process').execSync(
                `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'chrome.exe'\\" | Where-Object { $_.CommandLine -like '*${this.sessionId}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
                { stdio: 'ignore', timeout: 5000 }
              );
            } catch (e) {}
            try { fs.unlinkSync(lockfilePath); } catch (e) {}
          }
        }
      }
    } catch (e) {}

    try {
      await client.initialize();
      // A reset may have started while this asynchronous initialization ran.
      // Never let that obsolete client keep the Chrome profile locked.
      if (version !== this.lifecycleVersion || this.client !== client) {
        await client.destroy().catch(() => {});
        return;
      }
      if (client.pupBrowser?.process()) {
        this.browserPid = client.pupBrowser.process().pid;
        console.log(`[WhatsAppService] Puppeteer browser PID: ${this.browserPid}`);
      }
    } catch (err) {
      console.error('[WhatsAppService] Initialization Error:', err);
      if (version === this.lifecycleVersion) {
        this.status = 'DISCONNECTED';
      }
    }
  }

  killProcessTree(pid) {
    if (!pid) return;
    try {
      console.log(`[WhatsAppService] Terminating browser process tree PID ${pid}...`);
      if (process.platform === 'win32') {
        require('child_process').execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch (e) {}
  }

  /**
   * Bind WhatsApp Client lifecycle events
   */
  registerEvents(client, version) {
    // Fired when a QR code is generated for initial authentication
    client.on('qr', async (qr) => {
      if (version !== this.lifecycleVersion || this.client !== client) return;
      this.status = 'QR_READY';
      this.qrCodeRaw = qr;
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        console.log('[WhatsAppService] QR Code generated. Scan it via WhatsApp on your phone.');
        console.log('[WhatsAppService] QR code image available at: http://localhost:' + config.port + '/api/qr');
      } catch (err) {
        console.error('[WhatsAppService] Failed to generate QR Data URL:', err);
      }
    });

    client.on('loading_screen', (percent, message) => {
      if (version !== this.lifecycleVersion || this.client !== client) return;
      this.loadingPercent = percent;
      console.log(`[WhatsAppService] Loading screen: ${percent}% - ${message}`);
    });

    // Fired when session is successfully authenticated
    client.on('authenticated', () => {
      if (version !== this.lifecycleVersion || this.client !== client) return;
      this.status = 'AUTHENTICATING';
      this.qrCodeRaw = null;
      this.qrCodeDataUrl = null;
      console.log('[WhatsAppService] Client authenticated successfully. Loading session...');

      // Actively poll to detect WhatsApp connected state without hanging
      let pollCount = 0;
      const authPollInterval = setInterval(async () => {
        pollCount += 1;
        if (version !== this.lifecycleVersion || this.client !== client || this.status === 'CONNECTED' || pollCount > 40) {
          clearInterval(authPollInterval);
          return;
        }
        const connected = await this.syncConnectionState();
        if (connected) {
          clearInterval(authPollInterval);
        }
      }, 1500);
    });

    // Fired when authentication fails (e.g., invalidated session)
    client.on('auth_failure', (msg) => {
      if (version !== this.lifecycleVersion || this.client !== client) return;
      this.status = 'AUTH_FAILURE';
      this.loadingPercent = 0;
      console.error('[WhatsAppService] Authentication Failure:', msg);
    });

    // Fired when client is connected and fully ready to send/receive messages
    client.on('ready', () => {
      if (version !== this.lifecycleVersion || this.client !== client) return;
      this.status = 'CONNECTED';
      this.loadingPercent = 100;
      this.lastConnectedAt = new Date().toISOString();
      this.clientInfo = {
        pushname: client.info?.pushname || 'Safe Vault User',
        phone: client.info?.wid ? (client.info.wid.user || String(client.info.wid).replace(/\D/g, '')) : 'Unknown',
        platform: client.info?.platform || 'Unknown'
      };
      console.log(`[WhatsAppService] WhatsApp Client is READY! Logged in as: ${this.clientInfo.pushname} (${this.clientInfo.phone})`);
    });

    // Fired when client gets disconnected
    client.on('disconnected', (reason) => {
      if (version !== this.lifecycleVersion || this.client !== client) return;
      this.status = 'DISCONNECTED';
      this.lastDisconnectedAt = new Date().toISOString();
      this.clientInfo = null;
      this.loadingPercent = 0;
      console.warn('[WhatsAppService] Client was disconnected. Reason:', reason);
    });
  }

  /**
   * Actively check and sync connected state from client socket/page
   */
  async syncConnectionState() {
    if (!this.client) return false;
    if (this.status === 'CONNECTED' && this.clientInfo?.phone && this.clientInfo.phone !== 'Unknown') {
      return true;
    }

    try {
      let isConnected = false;
      try {
        const socketState = await this.client.getState();
        if (socketState === 'CONNECTED') isConnected = true;
      } catch (_) {}

      let info = this.client.info;
      let phone = info?.wid ? (info.wid.user || String(info.wid).replace(/\D/g, '')) : null;
      let pushname = info?.pushname || null;
      let platform = info?.platform || 'WhatsApp Web';

      if ((!phone || phone === 'Unknown') && this.client.pupPage) {
        try {
          const evalData = await this.client.pupPage.evaluate(() => {
            try {
              const me = window.require?.('WAWebUserPrefsMeUser')?.getMaybeMePnUser?.() ||
                         window.require?.('WAWebUserPrefsMeUser')?.getMaybeMeLidUser?.() ||
                         window.Store?.Conn?.wid?._serialized ||
                         window.Store?.User?.getMaybeMeUser?.()?._serialized;
              const name = window.Store?.Conn?.pushname ||
                           window.require?.('WAWebConnModel')?.Conn?.pushname || '';
              return { me: me ? String(me) : null, name };
            } catch (e) {
              return null;
            }
          }).catch(() => null);

          if (evalData?.me) {
            phone = evalData.me.replace(/\D/g, '');
            pushname = evalData.name || pushname;
            isConnected = true;
          }
        } catch (_) {}
      }

      if (isConnected || (phone && phone.length >= 7) || (this.status === 'AUTHENTICATING' && info?.wid)) {
        this.status = 'CONNECTED';
        this.qrCodeRaw = null;
        this.qrCodeDataUrl = null;
        this.lastConnectedAt = this.lastConnectedAt || new Date().toISOString();
        this.clientInfo = {
          pushname: pushname || this.clientInfo?.pushname || 'Safe Vault User',
          phone: phone || this.clientInfo?.phone || 'Connected',
          platform: platform
        };
        console.log(`[WhatsAppService] Proactively detected connected state! Logged in as: ${this.clientInfo.pushname} (${this.clientInfo.phone})`);
        return true;
      }
    } catch (err) {
      console.warn('[WhatsAppService] syncConnectionState warning:', err.message);
    }
    return false;
  }

  /**
   * Returns current status information
   */
  getStatus() {
    return {
      status: this.status,
      isConnected: this.status === 'CONNECTED',
      qrReady: this.status === 'QR_READY',
      qrDataUrl: this.qrCodeDataUrl,
      clientInfo: this.clientInfo,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      instanceId: this.sessionId || config.sessionId || 'safevault-session',
      accessToken: config.apiKey || 'safevault_default_token',
      loadingPercent: this.loadingPercent || 0
    };
  }

  /**
   * Returns current QR code (raw and base64 Data URL)
   */
  getQrCode() {
    return {
      status: this.status,
      isConnected: this.status === 'CONNECTED',
      qrReady: this.status === 'QR_READY',
      qrRaw: this.qrCodeRaw,
      qrDataUrl: this.qrCodeDataUrl,
      clientInfo: this.clientInfo,
      loadingPercent: this.loadingPercent || 0
    };
  }

  /**
   * Formats raw phone number to WhatsApp standard JID (e.g., 919876543210@c.us)
   * Handles country code cleanups, spaces, dashes, plus signs
   */
  formatPhoneNumber(phone) {
    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Convert to string and remove all non-digit characters
    let cleaned = phone.toString().replace(/\D/g, '');

    // Remove leading zeros if present
    if (cleaned.startsWith('00')) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Must be at least 7 digits to be a valid phone number
    if (cleaned.length < 7 || cleaned.length > 15) {
      throw new Error(`Invalid phone number format: "${phone}". Must include country code without symbols (e.g. 919876543210).`);
    }

    const jid = `${cleaned}@c.us`;
    return { cleaned, jid };
  }

  /**
   * Sends a single WhatsApp message
   */
  async sendMessage(phoneNumber, message, mediaOptions = null) {
    if (this.status !== 'CONNECTED' || !this.client) {
      throw new Error(`WhatsApp client is not ready. Current status: ${this.status}. Please scan QR code first.`);
    }

    const hasMedia = !!mediaOptions;
    const msgText = (typeof message === 'string') ? message.trim() : (message !== undefined && message !== null ? message.toString().trim() : '');

    if (!msgText && !hasMedia) {
      throw new Error('Message text or image attachment cannot be empty');
    }

    const { cleaned, jid } = this.formatPhoneNumber(phoneNumber);

    // Get the registered WhatsApp ID for the number
    let targetJid = jid;
    try {
      const numberDetails = await this.client.getNumberId(cleaned);
      if (numberDetails && numberDetails._serialized) {
        targetJid = numberDetails._serialized;
      } else {
        const isRegistered = await this.client.isRegisteredUser(jid);
        if (!isRegistered) {
          throw new Error(`Phone number ${cleaned} is not registered on WhatsApp.`);
        }
      }
    } catch (checkErr) {
      if (checkErr.message.includes('not registered')) {
        throw checkErr;
      }
      console.warn('[WhatsAppService] getNumberId fallback to jid:', checkErr.message);
    }

    console.log(`[WhatsAppService] Sending ${hasMedia ? 'media ' : ''}message to ${targetJid}...`);

    let response;
    if (hasMedia) {
      const media = await buildMessageMedia(mediaOptions);
      if (!media) throw new Error('Could not parse image attachment.');
      const sendOptions = msgText ? { caption: msgText } : {};
      response = await this.client.sendMessage(targetJid, media, sendOptions);
    } else {
      response = await this.client.sendMessage(targetJid, msgText);
    }

    console.log('[WhatsAppService] Send response received:', response ? 'Success' : 'Empty');

    return {
      success: true,
      messageId: response?.id?._serialized || response?.id || 'sent',
      recipient: cleaned,
      timestamp: response?.timestamp || Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Sends bulk messages with anti-ban rate limiting and jitter delay
   * @param {Array<string|object>} recipients Array of phone numbers or objects [{ phoneNumber, message, media }]
   * @param {string} defaultMessage Fallback message if recipient object doesn't provide one
   * @param {object} options Options including minDelayMs, maxDelayMs, media, mediaUrl
   */
  async sendBulk(recipients, defaultMessage = '', options = {}) {
    if (this.status !== 'CONNECTED' || !this.client) {
      throw new Error(`WhatsApp client is not ready. Current status: ${this.status}. Please scan QR code first.`);
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients must be a non-empty array of phone numbers or recipient objects');
    }

    const minDelay = options.minDelayMs || config.rateLimitMinDelayMs;
    const maxDelay = options.maxDelayMs || config.rateLimitMaxDelayMs;
    const globalMedia = options.media || options.mediaUrl || null;

    console.log(`[WhatsAppService] Starting bulk send to ${recipients.length} recipients with anti-ban delay (${minDelay}-${maxDelay}ms)...`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const item = recipients[i];
      const phoneNumber = typeof item === 'object' ? item.phoneNumber : item;
      const messageText = (typeof item === 'object' && item.message !== undefined) ? item.message : defaultMessage;
      const mediaOptions = (typeof item === 'object' && (item.media || item.mediaUrl)) ? (item.media || item.mediaUrl) : globalMedia;

      try {
        const sendResult = await this.sendMessage(phoneNumber, messageText, mediaOptions);
        results.push({
          phoneNumber,
          status: 'sent',
          messageId: sendResult.messageId,
          timestamp: sendResult.timestamp
        });
        successCount++;
        console.log(`[WhatsAppService] [${i + 1}/${recipients.length}] Sent to ${phoneNumber}`);
      } catch (err) {
        results.push({
          phoneNumber,
          status: 'failed',
          error: err.message
        });
        failureCount++;
        console.warn(`[WhatsAppService] [${i + 1}/${recipients.length}] Failed for ${phoneNumber}: ${err.message}`);
      }

      // If not the last message, apply randomized jitter delay for anti-ban safety
      if (i < recipients.length - 1) {
        const jitterDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        console.log(`[WhatsAppService] Waiting ${jitterDelay}ms before next message (anti-ban protection)...`);
        await new Promise((resolve) => setTimeout(resolve, jitterDelay));
      }
    }

    return {
      total: recipients.length,
      successful: successCount,
      failed: failureCount,
      results
    };
  }

  /**
   * Explicitly log out from the session and clean up
   */
  async logout() {
    if (this.client) {
      console.log('[WhatsAppService] Logging out from WhatsApp...');
      try {
        await this.client.logout();
        this.status = 'DISCONNECTED';
        this.clientInfo = null;
        this.qrCodeRaw = null;
        this.qrCodeDataUrl = null;
        return { success: true, message: 'Logged out successfully' };
      } catch (err) {
        console.error('[WhatsAppService] Logout Error:', err);
        throw err;
      }
    }
    return { success: true, message: 'No active client to log out' };
  }

  /**
   * Reset session: Cleans local auth cache and re-generates fresh QR code
   */
  async resetSession() {
    // A second reset while Chrome is still closing leaves the profile locked on
    // Windows. Share the in-progress reset instead of running two cleanups.
    if (this.resetPromise) {
      return this.resetPromise;
    }

    this.resetPromise = this.performResetSession().finally(() => {
      this.resetPromise = null;
    });

    return this.resetPromise;
  }

  async performResetSession() {
    console.log('[WhatsAppService] Resetting session and clearing auth folder...');
    // Invalidate any in-flight initialize() before it can open the old profile.
    this.lifecycleVersion += 1;
    const oldInitialization = this.initializationPromise;
    this.status = 'INITIALIZING';
    this.qrCodeRaw = null;
    this.qrCodeDataUrl = null;
    this.clientInfo = null;

    if (this.client) {
      const pid = this.client?.pupBrowser?.process()?.pid || this.browserPid;
      try {
        // Tell WhatsApp to invalidate the linked-device session before removing
        // its local profile. `destroy()` alone only closes Chrome.
        if (this.status === 'CONNECTED') {
          console.log('[WhatsAppService] Logging out linked WhatsApp device...');
          await Promise.race([
            this.client.logout(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp logout timed out')), 10000))
          ]);
        }
      } catch (e) {
        // Profile removal/new profile fallback below still guarantees a fresh QR.
        console.warn('[WhatsAppService] WhatsApp logout warning:', e.message);
      }

      try {
        console.log('[WhatsAppService] Destroying client browser...');
        await Promise.race([
          this.client.destroy(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timed out')), 10000))
        ]);
      } catch (e) {
        console.warn('[WhatsAppService] Destroy warning:', e.message);
      }

      if (pid) {
        try {
          console.log(`[WhatsAppService] Ensuring browser process PID ${pid} is closed...`);
          if (process.platform === 'win32') {
            require('child_process').execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
          } else {
            process.kill(pid, 'SIGKILL');
          }
        } catch (e) {}
      }

      this.client = null;
      this.browserPid = null;
    }

    // Give an obsolete initialize() a chance to finish its own cleanup. If it
    // does not, detach it; its lifecycle version prevents it affecting the new client.
    if (oldInitialization) {
      await Promise.race([
        oldInitialization.catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 10000))
      ]);
      if (this.initializationPromise === oldInitialization) {
        this.initializationPromise = null;
      }
    }

    // Windows releases Chrome profile handles shortly after taskkill completes.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fs = require('fs');
    // LocalAuth stores this client's Chrome profile in its own session folder.
    // Removing the parent `.wwebjs_auth` directory can stall on Windows while
    // the directory handle itself is being released; removing this profile is
    // both sufficient for logout and avoids that parent-directory lock.
    const sessionAuthPath = path.join(config.authDataPath, `session-${this.sessionId}`);
    if (fs.existsSync(sessionAuthPath)) {
      let lastError;
      for (let attempt = 1; attempt <= 8; attempt++) {
        try {
          fs.rmSync(sessionAuthPath, {
            recursive: true,
            force: true,
            maxRetries: 2,
            retryDelay: 500
          });
          console.log('[WhatsAppService] Cleared WhatsApp session profile:', sessionAuthPath);
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          console.warn(`[WhatsAppService] Waiting for Chrome profile lock to release (${attempt}/8):`, err.message);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (lastError) {
        // Windows can retain a Chrome profile handle after its browser process
        // has exited. A distinct LocalAuth client id creates a clean profile,
        // so pairing can continue immediately instead of leaving the UI stuck.
        const lockedSessionId = this.sessionId;
        this.sessionId = `${config.sessionId}-reset-${Date.now()}`;
        console.warn(`[WhatsAppService] Old profile ${lockedSessionId} is locked (${lastError.code || lastError.message}). Starting a fresh profile: ${this.sessionId}`);
      }
    }

    // Start a fresh client only after the old profile was actually removed.
    this.initialize().catch((initErr) => {
      console.error('[WhatsAppService] Re-initialization error after reset:', initErr);
    });

    return { success: true, message: 'Session reset. Generating fresh QR code...' };
  }

  /**
   * Graceful shutdown of WhatsApp client and Puppeteer browser
   */
  async destroy() {
    if (this.client) {
      console.log('[WhatsAppService] Destroying client and closing Puppeteer browser...');
      try {
        await this.client.destroy();
        this.status = 'DISCONNECTED';
        console.log('[WhatsAppService] WhatsApp client destroyed cleanly.');
      } catch (err) {
        console.error('[WhatsAppService] Error destroying client:', err);
      }
    }
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService();
module.exports = whatsappService;

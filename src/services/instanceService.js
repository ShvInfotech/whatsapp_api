const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const config = require('../config');

class InstanceService {
  constructor() {
    this.instances = new Map(); // instanceId -> InstanceState
    this.isInitialized = false;
  }

  /**
   * Safe read of data/instances.json
   */
  readStore() {
    try {
      if (!fs.existsSync(config.instancesDataPath)) {
        fs.writeFileSync(config.instancesDataPath, '[]', 'utf8');
        return [];
      }
      const raw = fs.readFileSync(config.instancesDataPath, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      console.error('[InstanceService] Error reading instances.json:', err);
      return [];
    }
  }

  /**
   * Safe write to data/instances.json
   */
  writeStore(data) {
    try {
      const dir = path.dirname(config.instancesDataPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(config.instancesDataPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[InstanceService] Error writing instances.json:', err);
    }
  }

  /**
   * Initialize and restore all saved instances on server startup
   */
  async initAll() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[InstanceService] Booting Multi-Instance WhatsApp Manager...');
    const saved = this.readStore();

    for (const record of saved) {
      try {
        console.log(`[InstanceService] Restoring instance ${record.name || ''} (${record.id})...`);
        await this.startClient(record.id, record.name, record.accessToken, record.createdAt);
      } catch (err) {
        console.error(`[InstanceService] Failed to restore instance ${record.id}:`, err);
      }
    }
    console.log(`[InstanceService] Multi-Instance Manager loaded ${saved.length} instance(s).`);
  }

  /**
   * Generate SendBuddy-style 13-char uppercase hex ID
   */
  generateInstanceId() {
    return crypto.randomBytes(7).toString('hex').slice(0, 13).toUpperCase();
  }

  /**
   * Generate 24-character hex access token
   */
  generateAccessToken() {
    return crypto.randomBytes(12).toString('hex');
  }

  /**
   * Start a single WhatsApp Client instance
   */
  async startClient(instanceId, name, accessToken, createdAt) {
    const existing = this.instances.get(instanceId);
    if (existing && existing.client) {
      return existing;
    }

    const state = {
      id: instanceId,
      name: name || `Instance ${instanceId.slice(0, 6)}`,
      accessToken: accessToken || this.generateAccessToken(),
      createdAt: createdAt || new Date().toISOString(),
      status: 'INITIALIZING',
      qrCodeRaw: null,
      qrCodeDataUrl: null,
      clientInfo: null,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lifecycleVersion: Date.now(),
      client: null,
      initPromise: null
    };

    this.instances.set(instanceId, state);

    const puppeteerOptions = {
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-default-apps',
        '--mute-audio'
      ]
    };

    if (config.chromePath) {
      puppeteerOptions.executablePath = config.chromePath;
    }

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: instanceId,
        dataPath: config.authDataPath
      }),
      puppeteer: puppeteerOptions
    });

    state.client = client;
    this.registerEvents(client, state);

    state.initPromise = client.initialize().catch((err) => {
      console.error(`[InstanceService] [${instanceId}] Initialization failed:`, err);
      state.status = 'DISCONNECTED';
    });

    return state;
  }

  /**
   * Attach event listeners to an instance client
   */
  registerEvents(client, state) {
    const currentVersion = state.lifecycleVersion;
    const instanceId = state.id;

    client.on('loading_screen', (percent, message) => {
      if (state.lifecycleVersion !== currentVersion) return;
      state.loadingPercent = percent;
      console.log(`[InstanceService] [${instanceId}] Loading screen: ${percent}% - ${message}`);
    });

    client.on('qr', async (qr) => {
      if (state.lifecycleVersion !== currentVersion) return;
      console.log(`[InstanceService] [${instanceId}] QR Code received.`);
      state.status = 'QR_READY';
      state.loadingPercent = 0;
      state.qrCodeRaw = qr;
      try {
        state.qrCodeDataUrl = await QRCode.toDataURL(qr, {
          width: 320,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
      } catch (err) {
        console.error(`[InstanceService] [${instanceId}] QR Generation error:`, err);
      }
      this.updateStoreRecord(instanceId, { status: state.status });
    });

    client.on('authenticated', () => {
      if (state.lifecycleVersion !== currentVersion) return;
      console.log(`[InstanceService] [${instanceId}] Authenticated.`);
      state.status = 'AUTHENTICATING';
      state.qrCodeRaw = null;
      state.qrCodeDataUrl = null;
      this.updateStoreRecord(instanceId, { status: state.status });

      // Start active connection poller to detect WhatsApp ready state without hanging
      let pollCount = 0;
      const authPollInterval = setInterval(async () => {
        pollCount += 1;
        if (state.lifecycleVersion !== currentVersion || state.status === 'CONNECTED' || pollCount > 40) {
          clearInterval(authPollInterval);
          return;
        }
        const connected = await this.syncConnectionState(instanceId);
        if (connected) {
          clearInterval(authPollInterval);
        }
      }, 1500);
    });

    client.on('ready', async () => {
      if (state.lifecycleVersion !== currentVersion) return;
      console.log(`[InstanceService] [${instanceId}] WhatsApp is READY and connected!`);
      state.status = 'CONNECTED';
      state.loadingPercent = 100;
      state.qrCodeRaw = null;
      state.qrCodeDataUrl = null;
      state.lastConnectedAt = new Date().toISOString();

      try {
        const info = client.info;
        if (info) {
          state.clientInfo = {
            pushname: info.pushname || 'User',
            phone: info.wid ? (info.wid.user || String(info.wid).replace(/\D/g, '')) : 'Unknown',
            platform: info.platform || 'Unknown'
          };
        }
      } catch (err) {
        console.warn(`[InstanceService] [${instanceId}] Could not read client.info:`, err);
      }

      this.updateStoreRecord(instanceId, {
        status: state.status,
        lastConnectedAt: state.lastConnectedAt,
        phone: state.clientInfo ? state.clientInfo.phone : null,
        pushname: state.clientInfo ? state.clientInfo.pushname : null
      });
    });

    client.on('disconnected', (reason) => {
      if (state.lifecycleVersion !== currentVersion) return;
      console.warn(`[InstanceService] [${instanceId}] Disconnected:`, reason);
      state.status = 'DISCONNECTED';
      state.clientInfo = null;
      state.loadingPercent = 0;
      state.qrCodeRaw = null;
      state.qrCodeDataUrl = null;
      state.lastDisconnectedAt = new Date().toISOString();
      this.updateStoreRecord(instanceId, {
        status: state.status,
        lastDisconnectedAt: state.lastDisconnectedAt
      });
    });

    client.on('auth_failure', (msg) => {
      if (state.lifecycleVersion !== currentVersion) return;
      console.error(`[InstanceService] [${instanceId}] Authentication failure:`, msg);
      state.status = 'AUTH_FAILURE';
      state.loadingPercent = 0;
      state.qrCodeRaw = null;
      state.qrCodeDataUrl = null;
      this.updateStoreRecord(instanceId, { status: state.status });
    });
  }

  /**
   * Actively check and sync connected state from client socket/page
   */
  async syncConnectionState(instanceId) {
    const state = this.instances.get(instanceId);
    if (!state || !state.client) return false;

    if (state.status === 'CONNECTED' && state.clientInfo?.phone && state.clientInfo.phone !== 'Unknown') {
      return true;
    }

    try {
      const client = state.client;
      let isConnected = false;

      // 1. Check socket state
      try {
        const socketState = await client.getState();
        if (socketState === 'CONNECTED') isConnected = true;
      } catch (_) {}

      // 2. Check client.info
      let info = client.info;
      let phone = info?.wid ? (info.wid.user || String(info.wid).replace(/\D/g, '')) : null;
      let pushname = info?.pushname || null;
      let platform = info?.platform || 'WhatsApp Web';

      // 3. If phone is missing or client.info is empty, inspect page directly
      if ((!phone || phone === 'Unknown') && client.pupPage) {
        try {
          const evalData = await client.pupPage.evaluate(() => {
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

      if (isConnected || (phone && phone.length >= 7) || (state.status === 'AUTHENTICATING' && info?.wid)) {
        state.status = 'CONNECTED';
        state.qrCodeRaw = null;
        state.qrCodeDataUrl = null;
        state.lastConnectedAt = state.lastConnectedAt || new Date().toISOString();
        state.clientInfo = {
          pushname: pushname || state.clientInfo?.pushname || 'User',
          phone: phone || state.clientInfo?.phone || 'Connected',
          platform: platform
        };

        this.updateStoreRecord(instanceId, {
          status: state.status,
          lastConnectedAt: state.lastConnectedAt,
          phone: state.clientInfo.phone,
          pushname: state.clientInfo.pushname
        });
        return true;
      }
    } catch (err) {
      console.warn(`[InstanceService] [${instanceId}] syncConnectionState warning:`, err.message);
    }
    return false;
  }

  /**
   * Helper to update record metadata in data/instances.json
   */
  updateStoreRecord(instanceId, updates) {
    const list = this.readStore();
    const idx = list.findIndex((x) => x.id === instanceId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
      this.writeStore(list);
    }
  }

  /**
   * Create a new instance
   */
  async createInstance(name, ownerUserId = null) {
    const instanceId = this.generateInstanceId();
    const accessToken = this.generateAccessToken();
    const createdAt = new Date().toISOString();

    const newRecord = {
      id: instanceId,
      name: name ? name.trim() : `Instance ${instanceId.slice(0, 6)}`,
      ownerUserId: ownerUserId ? ownerUserId.toString() : null,
      accessToken,
      createdAt,
      status: 'INITIALIZING',
      phone: null,
      pushname: null,
      lastConnectedAt: null,
      lastDisconnectedAt: null
    };

    const list = this.readStore();
    list.unshift(newRecord);
    this.writeStore(list);

    const state = await this.startClient(instanceId, newRecord.name, accessToken, createdAt);
    return this.serializeInstance(state);
  }

  /**
   * Get all instances formatted for dashboard
   */
  getAllInstances() {
    const list = this.readStore();
    const results = [];

    // Always include Default Device session at top
    try {
      const whatsappService = require('./whatsappService');
      const defaultStatus = whatsappService.getStatus();
      results.push({
        id: config.sessionId || 'safevault-session',
        name: 'Default Device (Primary)',
        accessToken: config.apiKey || 'safevault_default_token',
        isDefault: true,
        createdAt: 'Primary Session',
        status: defaultStatus.status,
        isConnected: defaultStatus.isConnected,
        qrReady: defaultStatus.qrReady,
        phone: (defaultStatus.clientInfo && defaultStatus.clientInfo.phone) || null,
        pushname: (defaultStatus.clientInfo && defaultStatus.clientInfo.pushname) || null,
        lastConnectedAt: defaultStatus.lastConnectedAt
      });
    } catch (_) {}

    for (const record of list) {
      if (record.id === config.sessionId) continue;
      const active = this.instances.get(record.id);
      results.push({
        id: record.id,
        name: record.name,
        ownerUserId: record.ownerUserId || null,
        accessToken: record.accessToken,
        createdAt: record.createdAt,
        status: active ? active.status : (record.status || 'DISCONNECTED'),
        isConnected: active ? active.status === 'CONNECTED' : false,
        qrReady: active ? active.status === 'QR_READY' : false,
        phone: (active && active.clientInfo && active.clientInfo.phone) || record.phone || null,
        pushname: (active && active.clientInfo && active.clientInfo.pushname) || record.pushname || null,
        lastConnectedAt: (active && active.lastConnectedAt) || record.lastConnectedAt || null
      });
    }

    return results;
  }

  /** Get only the WhatsApp instances owned by one registered user. */
  getInstancesForUser(userId) {
    const ownerId = userId.toString();
    return this.getAllInstances().filter((instance) => instance.ownerUserId === ownerId);
  }

  /**
   * Backfill an instance for users created before instance ownership was added.
   * This also makes user login resilient if a previous instance record was lost.
   */
  async ensureUserInstance(user) {
    const ownerId = user._id.toString();
    const existing = this.getInstancesForUser(ownerId);
    if (existing.length) return existing[0];
    return this.createInstance(`${user.fullName || user.username}'s WhatsApp`, ownerId);
  }

  /** A user can only access their own instance. */
  userOwnsInstance(userId, instanceId) {
    const record = this.getInstanceRecord(instanceId);
    return Boolean(record && record.ownerUserId === userId.toString());
  }

  /**
   * Find an instance state by ID
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Get instance record from JSON store
   */
  getInstanceRecord(instanceId) {
    const list = this.readStore();
    return list.find((x) => x.id === instanceId) || null;
  }

  /**
   * Validate instance_id and access_token
   */
  validateAuth(instanceId, accessToken) {
    if (!instanceId || !accessToken) return { valid: false, error: 'Missing instance_id or access_token' };

    // Check if targeting default device
    if (instanceId === config.sessionId || instanceId === 'default' || instanceId === 'safevault-session') {
      const defaultToken = config.apiKey || 'safevault_default_token';
      if (accessToken === defaultToken || !config.apiKey) {
        return { valid: true, record: { id: config.sessionId, name: 'Default Device' } };
      }
      return { valid: false, error: 'Invalid access_token for default device.' };
    }

    const record = this.getInstanceRecord(instanceId);
    if (!record) {
      return { valid: false, error: 'Instance not found. Check instance_id.' };
    }
    if (record.accessToken !== accessToken) {
      return { valid: false, error: 'Invalid access_token.' };
    }
    return { valid: true, record };
  }

  /**
   * Get QR code for an instance
   */
  async getInstanceQr(instanceId) {
    // If targeting default device
    if (instanceId === config.sessionId || instanceId === 'default' || instanceId === 'safevault-session') {
      const whatsappService = require('./whatsappService');
      const qrInfo = whatsappService.getQrCode();
      return {
        status: qrInfo.status,
        isConnected: qrInfo.isConnected,
        qrReady: qrInfo.qrReady,
        qrDataUrl: qrInfo.qrDataUrl,
        qrRaw: qrInfo.qrRaw,
        phone: qrInfo.clientInfo ? qrInfo.clientInfo.phone : null,
        pushname: qrInfo.clientInfo ? qrInfo.clientInfo.pushname : null
      };
    }

    const state = this.instances.get(instanceId);
    if (!state) {
      // Check if exists in store, if so start it
      const record = this.getInstanceRecord(instanceId);
      if (record) {
        const restarted = await this.startClient(record.id, record.name, record.accessToken, record.createdAt);
        return {
          status: restarted.status,
          qrReady: restarted.status === 'QR_READY',
          qrDataUrl: restarted.qrCodeDataUrl,
          qrRaw: restarted.qrCodeRaw
        };
      }
      return null;
    }

    // Actively verify connection if authenticating or client is active
    if (state.status === 'AUTHENTICATING' || (state.client && state.status !== 'CONNECTED')) {
      await this.syncConnectionState(instanceId);
    }

    return {
      status: state.status,
      isConnected: state.status === 'CONNECTED',
      qrReady: state.status === 'QR_READY',
      qrDataUrl: state.qrCodeDataUrl,
      qrRaw: state.qrCodeRaw,
      phone: state.clientInfo ? state.clientInfo.phone : null,
      pushname: state.clientInfo ? state.clientInfo.pushname : null,
      loadingPercent: state.loadingPercent || 0
    };
  }

  /**
   * Send WhatsApp message from a specific instance
   */
  async sendMessage(instanceId, recipientPhone, message) {
    // Check if targeting default session
    if (instanceId === config.sessionId || instanceId === 'default' || instanceId === 'safevault-session') {
      const whatsappService = require('./whatsappService');
      const sent = await whatsappService.sendMessage(recipientPhone, message);
      return {
        messageId: sent.messageId,
        to: sent.recipient,
        from: whatsappService.clientInfo ? whatsappService.clientInfo.phone : 'Default',
        timestamp: sent.timestamp
      };
    }

    const state = this.instances.get(instanceId);
    if (!state) {
      throw new Error(`Instance '${instanceId}' is not active on this server.`);
    }

    if (state.status !== 'CONNECTED' || !state.client) {
      throw new Error(`WhatsApp instance '${state.name || instanceId}' is not connected. Current status: ${state.status}`);
    }

    if (!recipientPhone || !recipientPhone.toString().trim()) {
      throw new Error('Recipient phone number is required.');
    }
    if (!message || !message.toString().trim()) {
      throw new Error('Message content cannot be empty.');
    }

    // Sanitize phone number (strip all non-digits, e.g. +, spaces, dashes)
    const sanitized = recipientPhone.toString().replace(/\D/g, '');
    if (sanitized.length < 10 || sanitized.length > 15) {
      throw new Error(`Invalid phone number length (${sanitized.length} digits). Provide full number with country code.`);
    }

    const chatId = `${sanitized}@c.us`;
    let targetJid = chatId;

    // Resolve registered WhatsApp ID via getNumberId
    try {
      if (typeof state.client.getNumberId === 'function') {
        const numberDetails = await state.client.getNumberId(sanitized);
        if (numberDetails && numberDetails._serialized) {
          targetJid = numberDetails._serialized;
        }
      }
    } catch (checkErr) {
      console.warn(`[InstanceService] [${instanceId}] getNumberId check warning:`, checkErr.message);
    }

    // Send Message
    let sent = null;
    try {
      sent = await state.client.sendMessage(targetJid, message.toString().trim());
    } catch (sendErr) {
      console.warn(`[InstanceService] [${instanceId}] Failed sending to ${targetJid}, trying fallback ${chatId}:`, sendErr.message);
      if (targetJid !== chatId) {
        sent = await state.client.sendMessage(chatId, message.toString().trim());
      } else {
        throw sendErr;
      }
    }

    const messageId = (sent && sent.id && sent.id._serialized)
      ? sent.id._serialized
      : (sent && sent.id ? sent.id : `msg_${Date.now()}`);

    return {
      messageId: messageId,
      to: sanitized,
      from: state.clientInfo ? state.clientInfo.phone : 'Me',
      timestamp: (sent && sent.timestamp) ? sent.timestamp : Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Reset session and generate fresh QR for an instance
   */
  async resetInstanceSession(instanceId) {
    const state = this.instances.get(instanceId);
    if (state) {
      state.lifecycleVersion = Date.now();
      state.status = 'INITIALIZING';
      state.qrCodeRaw = null;
      state.qrCodeDataUrl = null;
      state.clientInfo = null;

      if (state.client) {
        try {
          await state.client.logout().catch(() => {});
          await state.client.destroy().catch(() => {});
        } catch (_) {}
      }
    }

    // Remove session directory on disk
    const sessionDir = path.join(config.authDataPath, `session-${instanceId}`);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[InstanceService] [${instanceId}] Removed session directory.`);
      }
    } catch (rmErr) {
      console.warn(`[InstanceService] [${instanceId}] Could not delete session dir:`, rmErr.message);
    }

    // Restart client
    const record = this.getInstanceRecord(instanceId);
    if (record) {
      this.instances.delete(instanceId);
      return await this.startClient(record.id, record.name, record.accessToken, record.createdAt);
    }
    return null;
  }

  /**
   * Delete an instance completely
   */
  async deleteInstance(instanceId) {
    if (instanceId === config.sessionId || instanceId === 'default' || instanceId === 'safevault-session') {
      throw new Error('Cannot delete primary default session.');
    }

    const state = this.instances.get(instanceId);
    if (state && state.client) {
      try {
        state.lifecycleVersion = Date.now();
        await state.client.logout().catch(() => {});
        await state.client.destroy().catch(() => {});
      } catch (_) {}
      this.instances.delete(instanceId);
    }

    // Remove session dir
    const sessionDir = path.join(config.authDataPath, `session-${instanceId}`);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (_) {}

    // Remove from JSON store
    const list = this.readStore();
    const filtered = list.filter((x) => x.id !== instanceId);
    this.writeStore(filtered);

    return true;
  }

  /**
   * Graceful shutdown of all instances
   */
  async destroyAll() {
    console.log('[InstanceService] Terminating all active WhatsApp instances...');
    for (const [id, state] of this.instances.entries()) {
      if (state.client) {
        try {
          await state.client.destroy();
          console.log(`[InstanceService] Instance ${id} closed.`);
        } catch (_) {}
      }
    }
    this.instances.clear();
  }

  serializeInstance(state) {
    return {
      id: state.id,
      name: state.name,
      accessToken: state.accessToken,
      createdAt: state.createdAt,
      status: state.status,
      isConnected: state.status === 'CONNECTED',
      qrReady: state.status === 'QR_READY',
      phone: state.clientInfo ? state.clientInfo.phone : null,
      pushname: state.clientInfo ? state.clientInfo.pushname : null,
      lastConnectedAt: state.lastConnectedAt
    };
  }
}

// Export Singleton Instance
module.exports = new InstanceService();

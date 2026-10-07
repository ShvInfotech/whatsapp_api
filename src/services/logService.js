const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOGS_FILE = path.resolve(__dirname, '../../data/logs.json');

class LogService {
  constructor() {
    this.ensureStore();
  }

  ensureStore() {
    try {
      const dir = path.dirname(LOGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(LOGS_FILE)) {
        fs.writeFileSync(LOGS_FILE, '[]', 'utf8');
      }
    } catch (err) {
      console.error('[LogService] Error ensuring store:', err);
    }
  }

  readStore() {
    try {
      if (!fs.existsSync(LOGS_FILE)) return [];
      const raw = fs.readFileSync(LOGS_FILE, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      console.error('[LogService] Error reading logs.json:', err);
      return [];
    }
  }

  writeStore(data) {
    try {
      const dir = path.dirname(LOGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[LogService] Error writing logs.json:', err);
    }
  }

  addLog(userId, instanceId, { recipient, type = 'single', message = '', status = 'sent', error = null }) {
    try {
      const all = this.readStore();
      const logEntry = {
        id: `log_${crypto.randomBytes(6).toString('hex')}`,
        userId: userId ? userId.toString() : 'system',
        instanceId: instanceId || null,
        recipient: recipient ? String(recipient).replace(/\D/g, '') : '',
        type: type, // 'single', 'bulk', 'template', 'api'
        preview: message ? (message.length > 90 ? `${message.slice(0, 90)}...` : message) : '',
        status: status, // 'sent', 'failed'
        error: error || null,
        timestamp: new Date().toISOString()
      };

      all.unshift(logEntry);

      // Keep maximum 1,000 recent logs to save disk space
      const trimmed = all.slice(0, 1000);
      this.writeStore(trimmed);
      return logEntry;
    } catch (err) {
      console.error('[LogService] Error adding log entry:', err);
      return null;
    }
  }

  getUserLogs(userId, limit = 50) {
    const uid = userId ? userId.toString() : null;
    const all = this.readStore();
    const userLogs = uid ? all.filter((l) => l.userId === uid) : all;
    return userLogs.slice(0, limit);
  }

  clearUserLogs(userId) {
    const uid = userId.toString();
    const all = this.readStore();
    const filtered = all.filter((l) => l.userId !== uid);
    this.writeStore(filtered);
    return true;
  }

  getUserStats(userId) {
    const logs = this.getUserLogs(userId, 500);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const total = logs.length;
    const successful = logs.filter((l) => l.status === 'sent').length;
    const failed = logs.filter((l) => l.status === 'failed').length;
    const sentToday = logs.filter((l) => l.status === 'sent' && l.timestamp.startsWith(todayStr)).length;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 100;

    return {
      totalDispatched: total,
      successful,
      failed,
      sentToday,
      successRate
    };
  }
}

module.exports = new LogService();

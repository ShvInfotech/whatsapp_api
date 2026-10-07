const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDatabase } = require('./databaseService');

const TRANSACTIONS_FILE = path.resolve(__dirname, '../../data/transactions.json');

class TransactionService {
  constructor() {
    this.ensureStore();
  }

  ensureStore() {
    try {
      const dir = path.dirname(TRANSACTIONS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(TRANSACTIONS_FILE)) {
        // Seed default transactions matching existing user plans
        const defaultSeeds = [
          {
            id: 'tx_seed_101',
            orderId: 'order_PRO_98241',
            paymentId: 'pay_PRO_48102948',
            userId: '6abceb9415a04be4382f0fa8',
            userName: 'User One',
            userEmail: 'user1@example.com',
            planId: 'pro',
            planName: 'Pro Business Plan',
            amount: 1499,
            currency: 'INR',
            creditsAdded: 25000,
            status: 'captured',
            method: 'Razorpay UPI',
            createdAt: '2026-09-30T10:59:32.000Z'
          },
          {
            id: 'tx_seed_102',
            orderId: 'order_PRO_81923',
            paymentId: 'pay_PRO_19284712',
            userId: '6abcea1015a04be4382f0fa7',
            userName: 'Shop Owner',
            userEmail: 'shopowner@example.com',
            planId: 'pro',
            planName: 'Pro Business Plan',
            amount: 1499,
            currency: 'INR',
            creditsAdded: 25000,
            status: 'captured',
            method: 'Razorpay Card',
            createdAt: '2026-09-30T10:53:04.000Z'
          },
          {
            id: 'tx_seed_103',
            orderId: 'order_STR_57192',
            paymentId: 'pay_STR_89102451',
            userId: '6abde37d07a0eab24a3d62ca',
            userName: 'Yash V Gajera',
            userEmail: 'yash_test@example.com',
            planId: 'starter',
            planName: 'Starter Booster Plan',
            amount: 499,
            currency: 'INR',
            creditsAdded: 5000,
            status: 'captured',
            method: 'Razorpay Netbanking',
            createdAt: '2026-10-01T04:57:15.000Z'
          }
        ];
        fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(defaultSeeds, null, 2), 'utf8');
      }
    } catch (err) {
      console.error('[TransactionService] Error ensuring store:', err);
    }
  }

  readStore() {
    try {
      if (!fs.existsSync(TRANSACTIONS_FILE)) return [];
      const raw = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      console.error('[TransactionService] Error reading transactions.json:', err);
      return [];
    }
  }

  writeStore(data) {
    try {
      const dir = path.dirname(TRANSACTIONS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[TransactionService] Error writing transactions.json:', err);
    }
  }

  async recordTransaction({
    userId,
    userName,
    userEmail,
    planId,
    planName,
    amount,
    currency = 'INR',
    orderId,
    paymentId,
    status = 'captured',
    method = 'Razorpay Gateway',
    creditsAdded = 0
  }) {
    const record = {
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      orderId: orderId || `ord_${Date.now()}`,
      paymentId: paymentId || `pay_${Date.now()}`,
      userId: userId ? userId.toString() : 'unknown',
      userName: userName || 'Customer',
      userEmail: userEmail || 'user@example.com',
      planId: planId || 'custom',
      planName: planName || 'Subscription Plan',
      amount: Number(amount) || 0,
      currency: currency || 'INR',
      creditsAdded: Number(creditsAdded) || 0,
      status: status || 'captured',
      method: method || 'Razorpay Gateway',
      createdAt: new Date().toISOString()
    };

    // Save to JSON file
    const list = this.readStore();
    list.unshift(record);
    this.writeStore(list);

    // Save to MongoDB if available
    try {
      const db = await getDatabase();
      await db.collection('transactions').insertOne({ ...record });
    } catch (err) {
      console.warn('[TransactionService] Could not persist to MongoDB, cached locally:', err.message);
    }

    return record;
  }

  async getAllTransactions(limit = 100) {
    try {
      const db = await getDatabase();
      const mongoTx = await db.collection('transactions').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
      if (mongoTx && mongoTx.length > 0) {
        return mongoTx.map(t => {
          const { _id, ...rest } = t;
          return { id: _id ? _id.toString() : t.id, ...rest };
        });
      }
    } catch (_) {}

    const fileTx = this.readStore();
    return fileTx.slice(0, limit);
  }

  async getRevenueStats() {
    const list = await this.getAllTransactions(500);
    const completed = list.filter(t => t.status === 'captured' || t.status === 'paid');
    const totalRevenue = completed.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalTransactions = completed.length;

    // Today's revenue
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRevenue = completed
      .filter(t => t.createdAt && t.createdAt.startsWith(todayStr))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      totalRevenue,
      totalTransactions,
      todayRevenue
    };
  }
}

module.exports = new TransactionService();

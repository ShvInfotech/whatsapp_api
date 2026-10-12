const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDatabase } = require('./databaseService');

const TEMPLATES_FILE = path.resolve(__dirname, '../../data/templates.json');

class TemplateService {
  constructor() {
    this.migrated = false;
  }

  readStore() {
    try {
      if (!fs.existsSync(TEMPLATES_FILE)) return [];
      const raw = fs.readFileSync(TEMPLATES_FILE, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      console.error('[TemplateService] Error reading fallback templates.json:', err.message);
      return [];
    }
  }

  async migrateFromStore(db) {
    if (this.migrated) return;
    try {
      const all = this.readStore();
      if (Array.isArray(all) && all.length > 0) {
        for (const item of all) {
          if (!item.userId || !item.code) continue;
          const uid = item.userId.toString();
          await db.collection('templates').updateOne(
            { userId: uid, code: item.code },
            {
              $setOnInsert: {
                id: item.id || `tpl_${crypto.randomBytes(6).toString('hex')}`,
                userId: uid,
                name: item.name || 'Unnamed Template',
                code: item.code,
                category: (item.category || 'general').toLowerCase(),
                content: item.content || '',
                variables: Array.isArray(item.variables) ? item.variables : this.extractVariables(item.content),
                isDefault: Boolean(item.isDefault),
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: item.updatedAt || new Date().toISOString()
              }
            },
            { upsert: true }
          );
        }
      }
      this.migrated = true;
    } catch (err) {
      console.error('[TemplateService] Migration error:', err.message);
    }
  }

  extractVariables(content) {
    if (!content) return [];
    const matches = content.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '').trim()))];
  }

  getDefaultTemplates(userId) {
    const uid = userId.toString();
    return [
      {
        id: `tpl_ord_${crypto.randomBytes(4).toString('hex')}`,
        userId: uid,
        name: 'E-Commerce Order Confirmation',
        code: 'order_confirmation',
        category: 'ecommerce',
        content: 'Hi {{customer_name}}, thank you for your order! Your order #{{order_id}} for {{amount}} has been confirmed. Track status here: {{tracking_link}}',
        variables: ['customer_name', 'order_id', 'amount', 'tracking_link'],
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `tpl_shp_${crypto.randomBytes(4).toString('hex')}`,
        userId: uid,
        name: 'Order Dispatched & Tracking',
        code: 'order_dispatched',
        category: 'ecommerce',
        content: 'Hello {{customer_name}}, great news! Your order #{{order_id}} has been shipped via {{courier}}. Tracking No: {{tracking_number}}. Live tracking: {{tracking_link}}',
        variables: ['customer_name', 'order_id', 'courier', 'tracking_number', 'tracking_link'],
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `tpl_crt_${crypto.randomBytes(4).toString('hex')}`,
        userId: uid,
        name: 'Abandoned Cart Reminder',
        code: 'cart_reminder',
        category: 'ecommerce',
        content: 'Hi {{customer_name}}, you left {{item_name}} in your shopping cart! Complete your order now and enjoy {{discount}} off: {{checkout_link}}',
        variables: ['customer_name', 'item_name', 'discount', 'checkout_link'],
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `tpl_vlt_${crypto.randomBytes(4).toString('hex')}`,
        userId: uid,
        name: 'Safe Vault Access Alert',
        code: 'vault_access_alert',
        category: 'alerts',
        content: 'Security Alert: User {{person_name}} has accessed Locker/Vault #{{locker_id}} at {{datetime}}. Security Token: {{auth_token}}',
        variables: ['person_name', 'locker_id', 'datetime', 'auth_token'],
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  async getUserTemplates(userId) {
    const uid = userId.toString();
    const db = await getDatabase();
    await this.migrateFromStore(db);

    const templates = await db.collection('templates')
      .find({ userId: uid }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    if (templates.length === 0) {
      // Seed default starter templates specifically for this user
      const defaults = this.getDefaultTemplates(uid);
      await db.collection('templates').insertMany(defaults.map((t) => ({ ...t })));
      return defaults;
    }

    return templates;
  }

  async getTemplateById(userId, templateIdOrCode) {
    if (!userId || !templateIdOrCode) return null;
    const uid = userId.toString();
    const db = await getDatabase();
    await this.migrateFromStore(db);

    const template = await db.collection('templates').findOne(
      {
        userId: uid,
        $or: [{ id: templateIdOrCode }, { code: templateIdOrCode }]
      },
      { projection: { _id: 0 } }
    );

    return template || null;
  }

  async createTemplate(userId, { name, code, category, content }) {
    if (!name || !name.trim()) throw new Error('Template name is required.');
    if (!content || !content.trim()) throw new Error('Template message content is required.');

    const cleanCode = (code || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    if (!cleanCode) {
      throw new Error('A valid alphanumeric template code is required.');
    }

    const uid = userId.toString();
    const db = await getDatabase();
    await this.migrateFromStore(db);

    // Strictly check duplicate code within this user's account only
    const existing = await db.collection('templates').findOne({ userId: uid, code: cleanCode });
    if (existing) {
      throw new Error(`A template with code '${cleanCode}' already exists in your account.`);
    }

    const variables = this.extractVariables(content);
    const newTemplate = {
      id: `tpl_${crypto.randomBytes(6).toString('hex')}`,
      userId: uid,
      name: name.trim(),
      code: cleanCode,
      category: (category || 'general').toLowerCase().trim(),
      content: content.trim(),
      variables,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('templates').insertOne({ ...newTemplate });
    return newTemplate;
  }

  async updateTemplate(userId, templateId, { name, category, content }) {
    if (!templateId) throw new Error('Template ID is required.');
    const uid = userId.toString();
    const db = await getDatabase();
    await this.migrateFromStore(db);

    const existing = await db.collection('templates').findOne({
      userId: uid,
      $or: [{ id: templateId }, { code: templateId }]
    });
    if (!existing) {
      throw new Error('Template not found or unauthorized.');
    }

    const updateFields = { updatedAt: new Date().toISOString() };
    if (name && name.trim()) updateFields.name = name.trim();
    if (category) updateFields.category = category.toLowerCase().trim();
    if (content && content.trim()) {
      updateFields.content = content.trim();
      updateFields.variables = this.extractVariables(content);
    }

    await db.collection('templates').updateOne(
      { userId: uid, _id: existing._id },
      { $set: updateFields }
    );

    const updated = await db.collection('templates').findOne(
      { userId: uid, _id: existing._id },
      { projection: { _id: 0 } }
    );

    return updated;
  }

  async deleteTemplate(userId, templateId) {
    if (!templateId) throw new Error('Template ID is required.');
    const uid = userId.toString();
    const db = await getDatabase();
    await this.migrateFromStore(db);

    const result = await db.collection('templates').deleteOne({ userId: uid, id: templateId });
    if (result.deletedCount === 0) {
      throw new Error('Template not found or unauthorized.');
    }

    return true;
  }

  renderMessage(content, variables = {}) {
    if (!content) return '';
    let rendered = content;
    const cleanVars = typeof variables === 'object' && variables !== null ? variables : {};

    for (const [key, value] of Object.entries(cleanVars)) {
      const valStr = value !== undefined && value !== null ? String(value) : '';
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, valStr);
    }

    return rendered;
  }

  getTemplates(userId) {
    return this.getUserTemplates(userId);
  }
}

module.exports = new TemplateService();

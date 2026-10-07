const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMPLATES_FILE = path.resolve(__dirname, '../../data/templates.json');

class TemplateService {
  constructor() {
    this.ensureStore();
  }

  ensureStore() {
    try {
      const dir = path.dirname(TEMPLATES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(TEMPLATES_FILE)) {
        fs.writeFileSync(TEMPLATES_FILE, '[]', 'utf8');
      }
    } catch (err) {
      console.error('[TemplateService] Error ensuring store:', err);
    }
  }

  readStore() {
    try {
      if (!fs.existsSync(TEMPLATES_FILE)) return [];
      const raw = fs.readFileSync(TEMPLATES_FILE, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      console.error('[TemplateService] Error reading templates.json:', err);
      return [];
    }
  }

  writeStore(data) {
    try {
      const dir = path.dirname(TEMPLATES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[TemplateService] Error writing templates.json:', err);
    }
  }

  extractVariables(content) {
    if (!content) return [];
    const matches = content.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '').trim()))];
  }

  getDefaultTemplates(userId) {
    return [
      {
        id: `tpl_ord_${crypto.randomBytes(4).toString('hex')}`,
        userId: userId.toString(),
        name: 'E-Commerce Order Confirmation',
        code: 'order_confirmation',
        category: 'ecommerce',
        content: 'Hi {{customer_name}}, thank you for your order! Your order #{{order_id}} for {{amount}} has been confirmed. Track status here: {{tracking_link}}',
        variables: ['customer_name', 'order_id', 'amount', 'tracking_link'],
        isDefault: true,
        createdAt: new Date().toISOString()
      },
      {
        id: `tpl_shp_${crypto.randomBytes(4).toString('hex')}`,
        userId: userId.toString(),
        name: 'Order Dispatched & Tracking',
        code: 'order_dispatched',
        category: 'ecommerce',
        content: 'Hello {{customer_name}}, great news! Your order #{{order_id}} has been shipped via {{courier}}. Tracking No: {{tracking_number}}. Live tracking: {{tracking_link}}',
        variables: ['customer_name', 'order_id', 'courier', 'tracking_number', 'tracking_link'],
        isDefault: true,
        createdAt: new Date().toISOString()
      },
      {
        id: `tpl_crt_${crypto.randomBytes(4).toString('hex')}`,
        userId: userId.toString(),
        name: 'Abandoned Cart Reminder',
        code: 'cart_reminder',
        category: 'ecommerce',
        content: 'Hi {{customer_name}}, you left {{item_name}} in your shopping cart! Complete your order now and enjoy {{discount}} off: {{checkout_link}}',
        variables: ['customer_name', 'item_name', 'discount', 'checkout_link'],
        isDefault: true,
        createdAt: new Date().toISOString()
      },
      {
        id: `tpl_vlt_${crypto.randomBytes(4).toString('hex')}`,
        userId: userId.toString(),
        name: 'Safe Vault Access Alert',
        code: 'vault_access_alert',
        category: 'alerts',
        content: 'Security Alert: User {{person_name}} has accessed Locker/Vault #{{locker_id}} at {{datetime}}. Security Token: {{auth_token}}',
        variables: ['person_name', 'locker_id', 'datetime', 'auth_token'],
        isDefault: true,
        createdAt: new Date().toISOString()
      }
    ];
  }

  getUserTemplates(userId) {
    const uid = userId.toString();
    const all = this.readStore();
    const userTemplates = all.filter((t) => t.userId === uid);

    if (userTemplates.length === 0) {
      // Seed default templates for this user
      const defaults = this.getDefaultTemplates(uid);
      const updated = all.concat(defaults);
      this.writeStore(updated);
      return defaults;
    }

    return userTemplates;
  }

  getTemplateById(userId, templateId) {
    const templates = this.getUserTemplates(userId);
    return templates.find((t) => t.id === templateId || t.code === templateId) || null;
  }

  createTemplate(userId, { name, code, category, content }) {
    if (!name || !name.trim()) throw new Error('Template name is required.');
    if (!content || !content.trim()) throw new Error('Template message content is required.');

    const cleanCode = (code || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    const variables = this.extractVariables(content);
    const all = this.readStore();
    const uid = userId.toString();

    // Check duplicate code for user
    const existing = all.find((t) => t.userId === uid && t.code === cleanCode);
    if (existing) {
      throw new Error(`A template with code '${cleanCode}' already exists.`);
    }

    const newTemplate = {
      id: `tpl_${crypto.randomBytes(6).toString('hex')}`,
      userId: uid,
      name: name.trim(),
      code: cleanCode,
      category: (category || 'general').toLowerCase(),
      content: content.trim(),
      variables,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    all.push(newTemplate);
    this.writeStore(all);
    return newTemplate;
  }

  updateTemplate(userId, templateId, { name, category, content }) {
    const all = this.readStore();
    const uid = userId.toString();
    const index = all.findIndex((t) => t.userId === uid && t.id === templateId);

    if (index === -1) {
      throw new Error('Template not found or unauthorized.');
    }

    const target = all[index];
    if (name && name.trim()) target.name = name.trim();
    if (category) target.category = category.toLowerCase().trim();
    if (content && content.trim()) {
      target.content = content.trim();
      target.variables = this.extractVariables(content);
    }
    target.updatedAt = new Date().toISOString();

    all[index] = target;
    this.writeStore(all);
    return target;
  }

  deleteTemplate(userId, templateId) {
    const all = this.readStore();
    const uid = userId.toString();
    const filtered = all.filter((t) => !(t.userId === uid && t.id === templateId));

    if (filtered.length === all.length) {
      throw new Error('Template not found.');
    }

    this.writeStore(filtered);
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
}

module.exports = new TemplateService();

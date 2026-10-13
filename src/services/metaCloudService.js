const https = require('https');

/**
 * Meta WhatsApp Cloud API Service
 * Handles official WhatsApp Business Platform (Cloud API) dispatch
 * Supports Templates, Interactive Buttons (CTA, Quick Reply), and Media Headers
 */
class MetaCloudService {
  constructor() {
    this.apiVersion = process.env.META_API_VERSION || 'v20.0';
    this.defaultPhoneNumberId = process.env.META_PHONE_NUMBER_ID || '';
    this.defaultAccessToken = process.env.META_ACCESS_TOKEN || '';
  }

  /**
   * Internal helper to make HTTPS POST requests to Meta Graph API
   */
  async makeGraphRequest(phoneNumberId, accessToken, payload) {
    const pId = phoneNumberId || this.defaultPhoneNumberId;
    const token = accessToken || this.defaultAccessToken;

    if (!pId) {
      throw new Error('Meta Phone Number ID is required. Set META_PHONE_NUMBER_ID in .env or pass in request.');
    }
    if (!token) {
      throw new Error('Meta Access Token is required. Set META_ACCESS_TOKEN in .env or pass in request.');
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${pId}/messages`;

    // Use native fetch if available (Node 18+), else fallback to https.request
    if (typeof fetch === 'function') {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data?.error?.message || `Meta API Error (${response.status})`;
        const errorDetails = data?.error?.error_data?.details || '';
        throw new Error(`${errorMsg} ${errorDetails}`.trim());
      }
      return data;
    }

    // Node < 18 fallback
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const postData = JSON.stringify(payload);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              const errorMsg = data?.error?.message || `Meta API Error (${res.statusCode})`;
              reject(new Error(errorMsg));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Meta API response: ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    });
  }

  /**
   * Format phone number to clean digits (country code without '+' or special chars)
   */
  formatRecipient(phone) {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
  }

  /**
   * Send an Official Meta Template with Header (Image), Body Variables & Buttons
   * Matches the user's template format (Image + Text + Buttons)
   */
  async sendTemplate({
    to,
    templateName,
    languageCode = 'en',
    headerImageUrl = null,
    bodyVariables = [],
    buttons = [],
    phoneNumberId = null,
    accessToken = null
  }) {
    const recipient = this.formatRecipient(to);
    if (!recipient) throw new Error('Recipient phone number is required.');
    if (!templateName) throw new Error('Template name is required.');

    const components = [];

    // 1. Header (Image)
    if (headerImageUrl) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: { link: headerImageUrl }
          }
        ]
      });
    }

    // 2. Body Variables ({{1}}, {{2}}, etc.)
    if (Array.isArray(bodyVariables) && bodyVariables.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyVariables.map((val) => ({
          type: 'text',
          text: String(val)
        }))
      });
    }

    // 3. Dynamic URL / Quick Reply Buttons
    if (Array.isArray(buttons) && buttons.length > 0) {
      buttons.forEach((btn, idx) => {
        if (btn.type === 'url') {
          components.push({
            type: 'button',
            sub_type: 'url',
            index: String(btn.index !== undefined ? btn.index : idx),
            parameters: [
              {
                type: 'text',
                text: String(btn.url_variable || btn.text || '')
              }
            ]
          });
        } else if (btn.type === 'quick_reply') {
          components.push({
            type: 'button',
            sub_type: 'quick_reply',
            index: String(btn.index !== undefined ? btn.index : idx),
            parameters: [
              {
                type: 'payload',
                payload: String(btn.payload || btn.text || '')
              }
            ]
          });
        }
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 ? { components } : {})
      }
    };

    return this.makeGraphRequest(phoneNumberId, accessToken, payload);
  }

  /**
   * Send an Interactive Button Message (Up to 3 buttons)
   * Works for 24-hr customer service windows or interactive flow
   * Supports Image Header + Body Text + Footer Text + Up to 3 Reply Buttons
   */
  async sendInteractiveButtons({
    to,
    headerImageUrl = null,
    bodyText,
    footerText = null,
    buttons = [],
    phoneNumberId = null,
    accessToken = null
  }) {
    const recipient = this.formatRecipient(to);
    if (!recipient) throw new Error('Recipient phone number is required.');
    if (!bodyText) throw new Error('Body text is required for interactive buttons.');

    if (!Array.isArray(buttons) || buttons.length === 0) {
      throw new Error('At least one button is required (up to 3 buttons).');
    }

    // Build button list
    const formattedButtons = buttons.slice(0, 3).map((btn, index) => {
      const title = typeof btn === 'string' ? btn : (btn.title || btn.text || `Option ${index + 1}`);
      const id = typeof btn === 'object' && btn.id ? btn.id : `btn_${index + 1}_${Date.now()}`;
      return {
        type: 'reply',
        reply: {
          id: id.substring(0, 256),
          title: title.substring(0, 20) // WhatsApp limit: 20 chars per button title
        }
      };
    });

    const interactiveObj = {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: formattedButtons }
    };

    if (headerImageUrl) {
      interactiveObj.header = {
        type: 'image',
        image: { link: headerImageUrl }
      };
    }

    if (footerText) {
      interactiveObj.footer = {
        text: footerText.substring(0, 60) // WhatsApp limit: 60 chars
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: interactiveObj
    };

    return this.makeGraphRequest(phoneNumberId, accessToken, payload);
  }
}

module.exports = new MetaCloudService();

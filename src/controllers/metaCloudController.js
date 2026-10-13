const metaCloudService = require('../services/metaCloudService');

/**
 * Meta WhatsApp Cloud API Controller
 * Endpoints for sending official WhatsApp templates with buttons & interactive messages
 */
class MetaCloudController {
  /**
   * POST /api/meta/send-template
   * Send an approved Meta WhatsApp Template with Header Image, Variables & Buttons
   */
  async handleSendTemplate(req, res) {
    try {
      const {
        to,
        number,
        phone,
        template_name,
        templateName,
        language,
        language_code,
        image_url,
        header_image,
        variables,
        body_variables,
        buttons,
        phone_number_id,
        phoneNumberId,
        access_token,
        accessToken
      } = req.body;

      const recipient = to || number || phone;
      const tplName = template_name || templateName;
      const lang = language || language_code || 'en';
      const imgUrl = image_url || header_image || null;
      const vars = body_variables || variables || [];
      const pId = phone_number_id || phoneNumberId || null;
      const token = access_token || accessToken || null;

      if (!recipient) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing "to" or "number" parameter.'
        });
      }

      if (!tplName) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing "template_name" parameter.'
        });
      }

      const result = await metaCloudService.sendTemplate({
        to: recipient,
        templateName: tplName,
        languageCode: lang,
        headerImageUrl: imgUrl,
        bodyVariables: Array.isArray(vars) ? vars : Object.values(vars),
        buttons: buttons || [],
        phoneNumberId: pId,
        accessToken: token
      });

      return res.status(200).json({
        status: 'success',
        message: 'Meta Cloud API template sent successfully.',
        data: result
      });
    } catch (err) {
      console.error('[MetaCloudController] Send template error:', err.message);
      return res.status(500).json({
        status: 'error',
        message: err.message || 'Failed to send Meta Cloud API template.'
      });
    }
  }

  /**
   * POST /api/meta/send-interactive
   * Send Interactive Buttons (Image Header + Text + Up to 3 Action Buttons)
   */
  async handleSendInteractive(req, res) {
    try {
      const {
        to,
        number,
        phone,
        image,
        image_url,
        header_image,
        message,
        body,
        footer,
        buttons,
        phone_number_id,
        phoneNumberId,
        access_token,
        accessToken
      } = req.body;

      const recipient = to || number || phone;
      const imgUrl = image || image_url || header_image || null;
      const text = message || body;
      const footerText = footer || null;
      const pId = phone_number_id || phoneNumberId || null;
      const token = access_token || accessToken || null;

      if (!recipient) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing "to" or "number" parameter.'
        });
      }

      if (!text) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing "message" or "body" parameter.'
        });
      }

      if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing "buttons" array (e.g. ["Check Now", "Not Interested"]).'
        });
      }

      const result = await metaCloudService.sendInteractiveButtons({
        to: recipient,
        headerImageUrl: imgUrl,
        bodyText: text,
        footerText: footerText,
        buttons: buttons,
        phoneNumberId: pId,
        accessToken: token
      });

      return res.status(200).json({
        status: 'success',
        message: 'Meta Interactive buttons sent successfully.',
        data: result
      });
    } catch (err) {
      console.error('[MetaCloudController] Send interactive error:', err.message);
      return res.status(500).json({
        status: 'error',
        message: err.message || 'Failed to send interactive message.'
      });
    }
  }
}

module.exports = new MetaCloudController();

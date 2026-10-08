const instanceService = require('../services/instanceService');
const templateService = require('../services/templateService');
const logService = require('../services/logService');
const { incrementMessagesUsed, checkQuotaAvailable } = require('../services/userAuthService');

/**
 * SendBuddy Compatible WhatsApp Dispatch Controller
 * Handles GET & POST /api/send & /api/send-template
 */
class SendBuddyController {
  async handleSend(req, res) {
    try {
      // Extract from Query (for GET or URL-encoded params) or Body (for POST JSON/form)
      const number = req.query.number || req.body.number || req.query.phone || req.body.phone;
      const type = req.query.type || req.body.type || 'text';
      const message = req.query.message || req.body.message || '';
      const media = req.query.media || req.body.media || req.query.media_url || req.body.media_url || req.query.url || req.body.url || req.query.image || req.body.image;
      const instanceId = req.query.instance_id || req.body.instance_id || req.query.instanceId || req.body.instanceId;
      const accessToken = req.query.access_token || req.body.access_token || req.query.accessToken || req.body.accessToken;

      // 1. Validate required fields
      if (!instanceId) {
        return res.status(400).json({
          status: 'error',
          message: "Missing 'instance_id' parameter."
        });
      }

      if (!accessToken) {
        return res.status(401).json({
          status: 'error',
          message: "Missing 'access_token' parameter."
        });
      }

      if (!number) {
        return res.status(400).json({
          status: 'error',
          message: "Missing 'number' parameter (recipient phone number with country code)."
        });
      }

      if (!message && !media) {
        return res.status(400).json({
          status: 'error',
          message: "Missing 'message' or 'media_url' parameter."
        });
      }

      // 2. Validate instance credentials
      const auth = instanceService.validateAuth(instanceId, accessToken);
      if (!auth.valid) {
        return res.status(401).json({
          status: 'error',
          message: auth.error || 'Authentication failed for provided instance_id and access_token.'
        });
      }

      const ownerId = auth.record && auth.record.ownerUserId;

      // 3. Check quota if tied to an owner
      if (ownerId) {
        const quotaCheck = await checkQuotaAvailable(ownerId, 1);
        if (!quotaCheck.allowed) {
          return res.status(403).json({
            status: 'error',
            message: quotaCheck.error
          });
        }
      }

      // 4. Dispatch message through instance
      try {
        const result = await instanceService.sendMessage(instanceId, number, message, media);

        if (ownerId) {
          logService.addLog(ownerId, instanceId, {
            recipient: number,
            type: media ? 'media' : 'api',
            message: message || '[Media Attachment]',
            status: 'sent'
          });
          await incrementMessagesUsed(ownerId, 1);
        }

        return res.status(200).json({
          status: 'success',
          message: 'Message sent successfully',
          data: {
            id: result.messageId,
            to: result.to,
            from: result.from,
            type: type,
            timestamp: result.timestamp
          }
        });
      } catch (sendErr) {
        if (ownerId) {
          logService.addLog(ownerId, instanceId, {
            recipient: number,
            type: media ? 'media' : 'api',
            message: message || '[Media Attachment]',
            status: 'failed',
            error: sendErr.message
          });
        }
        throw sendErr;
      }
    } catch (err) {
      console.error('[SendBuddyController] Send error:', err.message);
      return res.status(500).json({
        status: 'error',
        message: err.message || 'Failed to dispatch WhatsApp message.'
      });
    }
  }

  /**
   * Public E-Commerce & Template API Dispatch
   * POST /api/send-template
   */
  async handleSendTemplate(req, res) {
    try {
      const instanceId = req.query.instance_id || req.body.instance_id || req.query.instanceId || req.body.instanceId;
      const accessToken = req.query.access_token || req.body.access_token || req.query.accessToken || req.body.accessToken;
      const number = req.query.number || req.body.number || req.query.phone || req.body.phone;
      const templateCode = req.query.template_code || req.body.template_code || req.query.template || req.body.template || req.body.templateId;
      let variables = req.body.variables || req.query.variables || {};

      if (typeof variables === 'string') {
        try {
          variables = JSON.parse(variables);
        } catch (_) {
          variables = {};
        }
      }

      if (!instanceId || !accessToken) {
        return res.status(401).json({ status: 'error', message: 'Missing instance_id or access_token.' });
      }

      if (!number) {
        return res.status(400).json({ status: 'error', message: 'Missing recipient phone number.' });
      }

      if (!templateCode) {
        return res.status(400).json({ status: 'error', message: "Missing 'template_code' parameter." });
      }

      // Validate auth
      const auth = instanceService.validateAuth(instanceId, accessToken);
      if (!auth.valid) {
        return res.status(401).json({ status: 'error', message: auth.error || 'Unauthorized instance.' });
      }

      const ownerId = auth.record && auth.record.ownerUserId;
      if (!ownerId) {
        return res.status(400).json({ status: 'error', message: 'No registered user owns this instance.' });
      }

      // Check quota
      const quotaCheck = await checkQuotaAvailable(ownerId, 1);
      if (!quotaCheck.allowed) {
        return res.status(403).json({ status: 'error', message: quotaCheck.error });
      }

      // Retrieve template
      const template = templateService.getTemplateById(ownerId, templateCode);
      if (!template) {
        return res.status(404).json({
          status: 'error',
          message: `Template '${templateCode}' not found. Check your template code in dashboard.`
        });
      }

      const renderedText = templateService.renderMessage(template.content, variables);

      try {
        const result = await instanceService.sendMessage(instanceId, number, renderedText);

        logService.addLog(ownerId, instanceId, {
          recipient: number,
          type: 'template_api',
          message: renderedText,
          status: 'sent'
        });
        await incrementMessagesUsed(ownerId, 1);

        return res.status(200).json({
          status: 'success',
          message: 'Template message sent successfully.',
          data: {
            id: result.messageId,
            to: result.to,
            template: template.name,
            rendered: renderedText,
            timestamp: result.timestamp
          }
        });
      } catch (sendErr) {
        logService.addLog(ownerId, instanceId, {
          recipient: number,
          type: 'template_api',
          message: renderedText,
          status: 'failed',
          error: sendErr.message
        });
        throw sendErr;
      }
    } catch (err) {
      console.error('[SendBuddyController] Send template error:', err.message);
      return res.status(500).json({
        status: 'error',
        message: err.message || 'Failed to dispatch template message.'
      });
    }
  }
}

module.exports = new SendBuddyController();

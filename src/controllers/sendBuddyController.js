const instanceService = require('../services/instanceService');

/**
 * SendBuddy Compatible WhatsApp Dispatch Controller
 * Handles GET & POST /api/send
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

      // 3. Dispatch message through instance
      const result = await instanceService.sendMessage(instanceId, number, message, media);

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
    } catch (err) {
      console.error('[SendBuddyController] Send error:', err.message);
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Failed to dispatch WhatsApp message.'
      });
    }
  }
}

module.exports = new SendBuddyController();

const instanceService = require('../services/instanceService');
const { register, authenticate, createSession, publicUser, listUsers } = require('../services/userAuthService');
const config = require('../config');

class UserController {
  async register(req, res) {
    try {
      const user = await register(req.body);
      // Every registered user receives one isolated WhatsApp instance.
      const instance = await instanceService.createInstance(`${user.fullName}'s WhatsApp`, user._id.toString());
      return res.status(201).json({ success: true, data: { user: publicUser(user), instance } });
    } catch (error) {
      return res.status(error.message.includes('required') || error.message.includes('valid') || error.message.includes('Password') || error.message.includes('already') ? 400 : 503)
        .json({ success: false, error: error.message || 'Could not register user.' });
    }
  }

  async login(req, res) {
    try {
      const user = await authenticate(req.body.username, req.body.password);
      if (!user) return res.status(401).json({ success: false, error: 'Invalid username or password.' });
      // Supports existing MongoDB users who were registered before their
      // WhatsApp instance record was created.
      await instanceService.ensureUserInstance(user);
      res.cookie('safevault_user_session', createSession(user), { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 8 * 60 * 60 * 1000 });
      return res.json({ success: true, data: publicUser(user) });
    } catch (_) {
      return res.status(503).json({ success: false, error: 'User database is unavailable. Check MongoDB connection.' });
    }
  }

  logout(req, res) {
    res.clearCookie('safevault_user_session', { httpOnly: true, sameSite: 'lax', secure: req.secure });
    res.json({ success: true });
  }

  async me(req, res) { return res.json({ success: true, data: publicUser(req.user) }); }

  async instances(req, res) {
    try {
      await instanceService.ensureUserInstance(req.user);
      return res.json({ success: true, data: instanceService.getInstancesForUser(req.user._id) });
    }
    catch (_) { return res.status(500).json({ success: false, error: 'Unable to load your WhatsApp instance.' }); }
  }

  async qr(req, res) {
    try {
      if (!instanceService.userOwnsInstance(req.user._id, req.params.id)) return res.status(404).json({ success: false, error: 'WhatsApp instance not found.' });
      const data = await instanceService.getInstanceQr(req.params.id);
      return res.json({ success: true, data });
    } catch (_) { return res.status(500).json({ success: false, error: 'Unable to load your WhatsApp QR code.' }); }
  }

  async reset(req, res) {
    try {
      if (!instanceService.userOwnsInstance(req.user._id, req.params.id)) return res.status(404).json({ success: false, error: 'WhatsApp instance not found.' });
      const instance = await instanceService.resetInstanceSession(req.params.id);
      return res.json({ success: true, data: instance ? instanceService.serializeInstance(instance) : null });
    } catch (_) { return res.status(500).json({ success: false, error: 'Unable to reset your WhatsApp session.' }); }
  }

  async sendMessage(req, res) {
    try {
      if (!instanceService.userOwnsInstance(req.user._id, req.params.id)) {
        return res.status(404).json({ success: false, error: 'WhatsApp instance not found.' });
      }
      const { phoneNumber, message, media, mediaUrl, filename, mimetype, image } = req.body;
      const mediaInput = media || mediaUrl || image || (filename ? { filename, mimetype, data: req.body.data } : null);

      if (!phoneNumber) {
        return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
      }
      if ((!message || !message.toString().trim()) && !mediaInput) {
        return res.status(400).json({ success: false, error: 'Message content or image attachment is required.' });
      }

      const data = await instanceService.sendMessage(req.params.id, phoneNumber, message || '', mediaInput);
      return res.json({ success: true, message: 'Message sent successfully.', data });
    } catch (error) {
      return res.status(error.message.includes('not connected') ? 503 : 400).json({
        success: false,
        error: error.message || 'Message could not be sent.'
      });
    }
  }

  async sendBulk(req, res) {
    try {
      if (!instanceService.userOwnsInstance(req.user._id, req.params.id)) {
        return res.status(404).json({ success: false, error: 'WhatsApp instance not found.' });
      }
      const { phoneNumbers, recipients, message, defaultMessage, media, mediaUrl, filename, mimetype, image, options = {} } = req.body;
      const numbers = phoneNumbers || recipients;
      const msgText = message !== undefined ? message : defaultMessage;
      const mediaInput = media || mediaUrl || image || (filename ? { filename, mimetype, data: req.body.data } : null);

      if (!Array.isArray(numbers) || !numbers.length || numbers.length > 100) {
        return res.status(400).json({ success: false, error: 'Provide 1 to 100 phone numbers.' });
      }
      if ((!msgText || !msgText.toString().trim()) && !mediaInput) {
        return res.status(400).json({ success: false, error: 'Message content or image attachment is required.' });
      }

      const minDelay = Math.max(1000, Number(options.minDelayMs) || config.rateLimitMinDelayMs);
      const maxDelay = Math.max(minDelay, Number(options.maxDelayMs) || config.rateLimitMaxDelayMs);
      const results = [];

      for (let index = 0; index < numbers.length; index += 1) {
        const item = numbers[index];
        const phoneNumber = typeof item === 'object' ? item.phoneNumber : item;
        const text = (typeof item === 'object' && item.message !== undefined) ? item.message : (msgText || '');
        const itemMedia = (typeof item === 'object' && (item.media || item.mediaUrl || item.image)) ? (item.media || item.mediaUrl || item.image) : mediaInput;

        try {
          const data = await instanceService.sendMessage(req.params.id, phoneNumber, text, itemMedia);
          results.push({ phoneNumber, status: 'sent', data });
        } catch (error) {
          results.push({ phoneNumber, status: 'failed', error: error.message });
        }

        if (index < numbers.length - 1) {
          const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      const successful = results.filter((result) => result.status === 'sent').length;
      return res.json({
        success: true,
        message: `Bulk messaging completed: ${successful}/${results.length} sent.`,
        data: { total: results.length, successful, failed: results.length - successful, results }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || 'Bulk messages could not be sent.' });
    }
  }

  async adminList(req, res) {
    try { return res.json({ success: true, data: await listUsers() }); }
    catch (_) { return res.status(503).json({ success: false, error: 'User database is unavailable. Check MongoDB connection.' }); }
  }
}

module.exports = new UserController();

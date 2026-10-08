const crypto = require('crypto');
const instanceService = require('../services/instanceService');
const templateService = require('../services/templateService');
const logService = require('../services/logService');
const transactionService = require('../services/transactionService');
const {
  register,
  authenticate,
  createSession,
  publicUser,
  listUsers,
  incrementMessagesUsed,
  checkQuotaAvailable,
  upgradeUserPlan,
  updateUserProfile,
  changeUserPassword,
  AVAILABLE_PLANS
} = require('../services/userAuthService');
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

  async me(req, res) {
    return res.json({ success: true, data: publicUser(req.user) });
  }

  async instances(req, res) {
    try {
      await instanceService.ensureUserInstance(req.user);
      return res.json({ success: true, data: instanceService.getInstancesForUser(req.user._id) });
    } catch (_) {
      return res.status(500).json({ success: false, error: 'Unable to load your WhatsApp instance.' });
    }
  }

  async qr(req, res) {
    try {
      if (!instanceService.userOwnsInstance(req.user._id, req.params.id)) {
        return res.status(404).json({ success: false, error: 'WhatsApp instance not found.' });
      }
      const data = await instanceService.getInstanceQr(req.params.id);
      return res.json({ success: true, data });
    } catch (_) {
      return res.status(500).json({ success: false, error: 'Unable to load your WhatsApp QR code.' });
    }
  }

  async reset(req, res) {
    try {
      if (!instanceService.userOwnsInstance(req.user._id, req.params.id)) {
        return res.status(404).json({ success: false, error: 'WhatsApp instance not found.' });
      }
      const instance = await instanceService.resetInstanceSession(req.params.id);
      return res.json({ success: true, data: instance ? instanceService.serializeInstance(instance) : null });
    } catch (_) {
      return res.status(500).json({ success: false, error: 'Unable to reset your WhatsApp session.' });
    }
  }

  async sendMessage(req, res) {
    try {
      if (!instanceService.userOwnsInstance(req.user._id, req.params.id)) {
        return res.status(404).json({ success: false, error: 'WhatsApp instance not found.' });
      }

      // Check quota limit
      const quotaCheck = await checkQuotaAvailable(req.user._id, 1);
      if (!quotaCheck.allowed) {
        return res.status(403).json({ success: false, error: quotaCheck.error });
      }

      const phoneNumber = req.body.phoneNumber || req.body.recipient || req.body.number || req.body.to || req.body.phone;
      const { message, caption, media, mediaUrl, filename, mimetype, image, data } = req.body;
      const messageText = (message || caption || '').toString().trim();

      // Build media input: prefer data URL / object forms.
      // The frontend sends either `media` (data URL string) or an object with
      // { filename, mimetype, data/base64 }. If only filename+mimetype are
      // present but the actual data came in `media`, keep the data URL there.
      const mediaInput = media || mediaUrl || image || (filename && (data || media) ? { filename, mimetype, data: data || media } : null);

      if (!phoneNumber || !phoneNumber.toString().trim()) {
        return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
      }
      if (!messageText && !mediaInput) {
        return res.status(400).json({ success: false, error: 'Message content or image attachment is required.' });
      }

      try {
        const data = await instanceService.sendMessage(req.params.id, phoneNumber, messageText, mediaInput);

        // Record log & increment quota
        logService.addLog(req.user._id, req.params.id, {
          recipient: phoneNumber,
          type: mediaInput ? 'media' : 'single',
          message: message || '[Image Attached]',
          status: 'sent'
        });
        await incrementMessagesUsed(req.user._id, 1);

        return res.json({ success: true, message: 'Message sent successfully.', data });
      } catch (sendErr) {
        logService.addLog(req.user._id, req.params.id, {
          recipient: phoneNumber,
          type: mediaInput ? 'media' : 'single',
          message: message || '[Image Attached]',
          status: 'failed',
          error: sendErr.message
        });
        throw sendErr;
      }
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

      if (!Array.isArray(numbers) || !numbers.length || numbers.length > 200) {
        return res.status(400).json({ success: false, error: 'Provide 1 to 200 phone numbers.' });
      }
      if ((!msgText || !msgText.toString().trim()) && !mediaInput) {
        return res.status(400).json({ success: false, error: 'Message content or image attachment is required.' });
      }

      // Check quota limit
      const quotaCheck = await checkQuotaAvailable(req.user._id, numbers.length);
      if (!quotaCheck.allowed) {
        return res.status(403).json({ success: false, error: quotaCheck.error });
      }

      const baseDelay = Number(options.delayMs) || (Number(options.delaySeconds || options.delay) * 1000) || null;
      const minDelay = baseDelay ? Math.max(500, baseDelay - 500) : Math.max(500, Number(options.minDelayMs) || config.rateLimitMinDelayMs);
      const maxDelay = baseDelay ? (baseDelay + 500) : Math.max(minDelay, Number(options.maxDelayMs) || config.rateLimitMaxDelayMs);
      const results = [];

      for (let index = 0; index < numbers.length; index += 1) {
        const item = numbers[index];
        const phoneNumber = typeof item === 'object' ? item.phoneNumber : item;
        const text = (typeof item === 'object' && item.message !== undefined) ? item.message : (msgText || '');
        const itemMedia = (typeof item === 'object' && (item.media || item.mediaUrl || item.image)) ? (item.media || item.mediaUrl || item.image) : mediaInput;

        try {
          const data = await instanceService.sendMessage(req.params.id, phoneNumber, text, itemMedia);
          results.push({ phoneNumber, status: 'sent', data });
          logService.addLog(req.user._id, req.params.id, {
            recipient: phoneNumber,
            type: 'bulk',
            message: text || '[Media]',
            status: 'sent'
          });
        } catch (error) {
          results.push({ phoneNumber, status: 'failed', error: error.message });
          logService.addLog(req.user._id, req.params.id, {
            recipient: phoneNumber,
            type: 'bulk',
            message: text || '[Media]',
            status: 'failed',
            error: error.message
          });
        }

        if (index < numbers.length - 1) {
          const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      const successful = results.filter((result) => result.status === 'sent').length;
      if (successful > 0) {
        await incrementMessagesUsed(req.user._id, successful);
      }

      return res.json({
        success: true,
        message: `Bulk messaging completed: ${successful}/${results.length} sent.`,
        data: { total: results.length, successful, failed: results.length - successful, results }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || 'Bulk messages could not be sent.' });
    }
  }

  // ================= TEMPLATE ENDPOINTS =================
  async getTemplates(req, res) {
    try {
      const templates = templateService.getUserTemplates(req.user._id);
      return res.json({ success: true, data: templates });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message || 'Failed to fetch templates.' });
    }
  }

  async createTemplate(req, res) {
    try {
      const template = templateService.createTemplate(req.user._id, req.body);
      return res.status(201).json({ success: true, data: template, message: 'Template created successfully.' });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async updateTemplate(req, res) {
    try {
      const template = templateService.updateTemplate(req.user._id, req.params.id, req.body);
      return res.json({ success: true, data: template, message: 'Template updated.' });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async deleteTemplate(req, res) {
    try {
      templateService.deleteTemplate(req.user._id, req.params.id);
      return res.json({ success: true, message: 'Template deleted.' });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async sendTemplateMessage(req, res) {
    try {
      const instanceId = req.params.id;
      if (!instanceService.userOwnsInstance(req.user._id, instanceId)) {
        return res.status(404).json({ success: false, error: 'WhatsApp instance not found.' });
      }

      const { templateId, templateCode, variables = {} } = req.body;
      const phoneNumber = req.body.phoneNumber || req.body.recipient || req.body.number || req.body.to || req.body.phone;
      if (!phoneNumber || !phoneNumber.toString().trim()) {
        return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
      }

      const template = templateService.getTemplateById(req.user._id, templateId || templateCode);
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found.' });
      }

      // Check quota
      const quotaCheck = await checkQuotaAvailable(req.user._id, 1);
      if (!quotaCheck.allowed) {
        return res.status(403).json({ success: false, error: quotaCheck.error });
      }

      const renderedText = templateService.renderMessage(template.content, variables);

      try {
        const data = await instanceService.sendMessage(instanceId, phoneNumber, renderedText);

        logService.addLog(req.user._id, instanceId, {
          recipient: phoneNumber,
          type: 'template',
          message: renderedText,
          status: 'sent'
        });
        await incrementMessagesUsed(req.user._id, 1);

        return res.json({
          success: true,
          message: 'Template message sent successfully.',
          data: {
            template: template.name,
            renderedMessage: renderedText,
            dispatch: data
          }
        });
      } catch (sendErr) {
        logService.addLog(req.user._id, instanceId, {
          recipient: phoneNumber,
          type: 'template',
          message: renderedText,
          status: 'failed',
          error: sendErr.message
        });
        throw sendErr;
      }
    } catch (error) {
      return res.status(error.message.includes('not connected') ? 503 : 400).json({
        success: false,
        error: error.message || 'Template message could not be sent.'
      });
    }
  }

  // ================= LOGS & ANALYTICS =================
  async getLogs(req, res) {
    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const logs = logService.getUserLogs(req.user._id, limit);
      return res.json({ success: true, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Unable to retrieve logs.' });
    }
  }

  async clearLogs(req, res) {
    try {
      logService.clearUserLogs(req.user._id);
      return res.json({ success: true, message: 'Message logs cleared.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Unable to clear logs.' });
    }
  }

  async getStats(req, res) {
    try {
      const stats = logService.getUserStats(req.user._id);
      return res.json({ success: true, data: stats });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Unable to load statistics.' });
    }
  }

  async upgradePlan(req, res) {
    try {
      const { planId } = req.body || {};
      if (!planId) {
        return res.status(400).json({ success: false, error: 'Please select a plan to upgrade or recharge.' });
      }
      const updatedUser = await upgradeUserPlan(req.user._id, planId);
      return res.json({
        success: true,
        message: `Plan updated successfully! Your message quota is now ${updatedUser.messageQuota.toLocaleString()}.`,
        user: updatedUser
      });
    } catch (err) {
      console.error('Plan upgrade error:', err);
      return res.status(400).json({ success: false, error: err.message || 'Failed to update plan.' });
    }
  }

  async getPlans(req, res) {
    return res.json({ success: true, data: AVAILABLE_PLANS });
  }

  async updateProfile(req, res) {
    try {
      const { fullName, username, email } = req.body || {};
      const updated = await updateUserProfile(req.user._id, { fullName, username, email });
      return res.json({
        success: true,
        message: 'Profile details updated successfully.',
        user: updated
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message || 'Failed to update profile.' });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      await changeUserPassword(req.user._id, currentPassword, newPassword);
      return res.json({
        success: true,
        message: 'Password changed successfully. Please keep your credentials secure.'
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message || 'Failed to change password.' });
    }
  }

  async createPaymentOrder(req, res) {
    try {
      const { planId } = req.body || {};
      const plan = AVAILABLE_PLANS[planId];
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Invalid plan or top-up selection.' });
      }

      const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_pixano';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const amountPaise = plan.price * 100;
      let orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let isMockOrder = true;

      // If Razorpay live/test key credentials provided, call official Razorpay Order API
      if (keyId && keySecret && !keyId.includes('mock')) {
        try {
          const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
          const resp = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              amount: amountPaise,
              currency: 'INR',
              receipt: `rcpt_${req.user._id.toString().substring(0, 6)}_${Date.now()}`,
              notes: {
                userId: req.user._id.toString(),
                planId: planId,
                planName: plan.name
              }
            })
          });
          const data = await resp.json();
          if (data && data.id) {
            orderId = data.id;
            isMockOrder = false;
          }
        } catch (fetchErr) {
          console.warn('[Razorpay] Order API fallback:', fetchErr.message);
        }
      }

      return res.json({
        success: true,
        orderId,
        amount: amountPaise,
        currency: 'INR',
        keyId,
        isMockOrder,
        plan: {
          id: planId,
          name: plan.name,
          price: plan.price,
          quota: plan.quota || plan.addQuota
        }
      });
    } catch (err) {
      console.error('Payment order error:', err);
      return res.status(500).json({ success: false, error: 'Failed to create payment order.' });
    }
  }

  async verifyPayment(req, res) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        planId,
        isSimulation
      } = req.body || {};

      if (!planId) {
        return res.status(400).json({ success: false, error: 'Plan identifier is required.' });
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      let isValid = false;

      if (keySecret && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
        const hmac = crypto.createHmac('sha256', keySecret);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest('hex');
        if (generatedSignature === razorpay_signature) {
          isValid = true;
        }
      } else if (isSimulation || razorpay_payment_id || razorpay_order_id) {
        // Standard checkout test or simulation mode
        isValid = true;
      }

      if (!isValid) {
        return res.status(400).json({ success: false, error: 'Payment signature could not be verified.' });
      }

      const updatedUser = await upgradeUserPlan(req.user._id, planId);
      const planInfo = AVAILABLE_PLANS[planId] || {};

      await transactionService.recordTransaction({
        userId: req.user._id,
        userName: req.user.fullName || req.user.username,
        userEmail: req.user.email,
        planId,
        planName: planInfo.name || updatedUser.plan || 'SaaS Plan',
        amount: planInfo.price || 0,
        currency: 'INR',
        creditsAdded: planInfo.quota || planInfo.addQuota || 0,
        orderId: razorpay_order_id || `ord_${Date.now()}`,
        paymentId: razorpay_payment_id || `sim_${Date.now()}`,
        status: 'captured',
        method: isSimulation ? 'Simulation Mode' : 'Razorpay Gateway'
      });

      return res.json({
        success: true,
        message: `Payment successful! Your account now has ${updatedUser.messageQuota.toLocaleString()} message credits.`,
        user: updatedUser,
        paymentId: razorpay_payment_id || `sim_${Date.now()}`
      });
    } catch (err) {
      console.error('Payment verification error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Payment verification failed.' });
    }
  }

  async adminList(req, res) {
    try {
      return res.json({ success: true, data: await listUsers() });
    } catch (_) {
      return res.status(503).json({ success: false, error: 'User database is unavailable. Check MongoDB connection.' });
    }
  }
}

module.exports = new UserController();

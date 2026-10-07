const whatsappService = require('../services/whatsappService');

class WhatsAppController {
  /**
   * GET /api/status
   * Returns current WhatsApp client connection status and device details
   */
  async getStatus(req, res) {
    try {
      const statusInfo = whatsappService.getStatus();
      return res.status(200).json({
        success: true,
        data: statusInfo
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * GET /api/qr
   * Returns the current QR code for scanning.
   * If accessed via a browser (Accept: text/html), renders a beautiful, auto-refreshing HTML page.
   * If accessed via JSON API, returns the raw QR string and base64 Data URL.
   */
  async getQrCode(req, res) {
    try {
      const qrInfo = whatsappService.getQrCode();

      // If client is already authenticated
      if (qrInfo.status === 'CONNECTED') {
        if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
          return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>WhatsApp Status - Connected</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
                .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 420px; border: 1px solid #334155; }
                .icon { font-size: 3.5rem; color: #10b981; margin-bottom: 1rem; }
                h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
                p { color: #94a3b8; line-height: 1.5; font-size: 0.95rem; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">✓</div>
                <h1>WhatsApp is Connected!</h1>
                <p>Your session is active and ready to send messages from <strong>Safe Vault Software</strong>.</p>
              </div>
            </body>
            </html>
          `);
        }
        return res.status(200).json({
          success: true,
          status: 'CONNECTED',
          message: 'Client is already connected and authenticated.'
        });
      }

      // If client is already authenticated and loading session
      if (qrInfo.status === 'AUTHENTICATING') {
        if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
          return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta http-equiv="refresh" content="3">
              <title>Restoring WhatsApp Session...</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
                .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; max-width: 440px; }
                .spinner { width: 44px; height: 44px; border: 4px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin 1s infinite linear; margin: 0 auto 1.5rem; }
                @keyframes spin { to { transform: rotate(360deg); } }
                p { color: #94a3b8; line-height: 1.6; }
                .btn { display: inline-block; margin-top: 1.25rem; padding: 0.6rem 1.2rem; background: #dc2626; color: white; text-decoration: none; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 500; }
                .btn:hover { background: #b91c1c; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="spinner"></div>
                <h2>Restoring WhatsApp Session...</h2>
                <p>You are already authenticated! WhatsApp is syncing chats from your phone. (No QR code needed).</p>
                <a href="/api/reset-session" class="btn" onclick="return confirm('Do you want to clear session and scan a fresh QR code?')">Reset & Scan New QR Code</a>
              </div>
            </body>
            </html>
          `);
        }

        return res.status(200).json({
          success: true,
          status: 'AUTHENTICATING',
          message: 'Client is already authenticated. Syncing chats from phone.'
        });
      }

      // If QR code is not generated yet (still initializing)
      if (!qrInfo.qrDataUrl) {
        if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
          return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta http-equiv="refresh" content="3">
              <title>Initializing WhatsApp...</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
                .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; max-width: 440px; }
                .spinner { width: 44px; height: 44px; border: 4px solid #334155; border-top-color: #22c55e; border-radius: 50%; animation: spin 1s infinite linear; margin: 0 auto 1.5rem; }
                @keyframes spin { to { transform: rotate(360deg); } }
                p { color: #94a3b8; line-height: 1.5; }
                .btn { display: inline-block; margin-top: 1.25rem; padding: 0.6rem 1.2rem; background: #334155; color: #f1f5f9; text-decoration: none; border-radius: 0.5rem; font-size: 0.85rem; }
                .btn:hover { background: #475569; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="spinner"></div>
                <h2>Starting WhatsApp Engine...</h2>
                <p>Generating pairing QR code. Please wait a moment...</p>
                <a href="/api/reset-session" class="btn">Stuck? Click here to Reset Session</a>
              </div>
            </body>
            </html>
          `);
        }

        return res.status(503).json({
          success: false,
          status: qrInfo.status,
          message: 'QR Code is not ready yet. Please wait a few seconds and retry.'
        });
      }

      // HTML Render for browser view
      if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
        return res.send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Scan WhatsApp QR Code - Safe Vault</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
              .card { background: #1e293b; padding: 2.5rem; border-radius: 1.25rem; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-width: 440px; border: 1px solid #334155; }
              h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
              p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem; }
              .qr-frame { background: #ffffff; padding: 1rem; border-radius: 0.75rem; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
              .qr-frame img { display: block; width: 280px; height: 280px; }
              .steps { text-align: left; margin-top: 1.5rem; background: #0f172a; padding: 1rem 1.25rem; border-radius: 0.5rem; font-size: 0.85rem; color: #cbd5e1; border: 1px solid #334155; }
              .steps ol { margin: 0; padding-left: 1.2rem; }
              .steps li { margin-bottom: 0.35rem; }
              .badge { display: inline-block; background: #0284c7; color: #ffffff; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin-bottom: 1rem; }
            </style>
            <script>
              // Poll status every 3 seconds to auto-reload once connected
              setInterval(async () => {
                try {
                  const res = await fetch('/api/status');
                  const data = await res.json();
                  if (data.success && data.data.isConnected) {
                    window.location.reload();
                  }
                } catch (e) {}
              }, 3000);
            </script>
          </head>
          <body>
            <div class="card">
              <span class="badge">Safe Vault Automation</span>
              <h1>Pair WhatsApp Device</h1>
              <p>Open WhatsApp on your phone, navigate to Linked Devices, and scan this QR code.</p>
              <div class="qr-frame">
                <img src="${qrInfo.qrDataUrl}" alt="WhatsApp QR Code" />
              </div>
              <div class="steps">
                <ol>
                  <li>Open <strong>WhatsApp</strong> on your phone</li>
                  <li>Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong></li>
                  <li>Tap <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong></li>
                  <li>Point your phone camera at this screen</li>
                </ol>
              </div>
            </div>
          </body>
          </html>
        `);
      }

      // JSON response for API consumers
      return res.status(200).json({
        success: true,
        status: qrInfo.status,
        qrRaw: qrInfo.qrRaw,
        qrDataUrl: qrInfo.qrDataUrl
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * POST /api/send-message
   * Accepts JSON: { "phoneNumber": "919876543210", "message": "Hello from Safe Vault" }
   */
  async sendMessage(req, res) {
    try {
      const { phoneNumber, message, media, mediaUrl, image } = req.body;
      const mediaInput = media || mediaUrl || image || null;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: "phoneNumber"'
        });
      }

      if (!message && !mediaInput) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: "message" or image attachment'
        });
      }

      const result = await whatsappService.sendMessage(phoneNumber, message || '', mediaInput);

      return res.status(200).json({
        success: true,
        message: 'Message sent successfully',
        data: result
      });
    } catch (err) {
      console.error('[WhatsAppController] Send message failed:', err);
      const isClientNotReady = err.message.includes('not ready');
      const isUnregistered = err.message.includes('not registered');
      const statusCode = isClientNotReady ? 503 : (isUnregistered ? 400 : 500);

      return res.status(statusCode).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * POST /api/send-bulk
   * Accepts JSON: { "phoneNumbers": ["919876543210", ...], "message": "...", "media": "..." }
   * or: { "recipients": [{ "phoneNumber": "...", "message": "..." }], "defaultMessage": "..." }
   */
  async sendBulk(req, res) {
    try {
      const { phoneNumbers, recipients, message, defaultMessage, media, mediaUrl, image, options } = req.body;

      const recipientList = recipients || phoneNumbers;
      const msgText = message || defaultMessage;
      const mediaInput = media || mediaUrl || image || null;

      if (!recipientList || !Array.isArray(recipientList) || recipientList.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid recipients. Provide an array in "phoneNumbers" or "recipients".'
        });
      }

      // If recipients is an array of strings, message or media is required
      if (typeof recipientList[0] === 'string' && !msgText && !mediaInput) {
        return res.status(400).json({
          success: false,
          error: 'A default "message" or image attachment is required when providing a list of phone numbers.'
        });
      }

      const bulkOpts = { ...(options || {}) };
      if (mediaInput) bulkOpts.media = mediaInput;

      const result = await whatsappService.sendBulk(recipientList, msgText, bulkOpts);

      return res.status(200).json({
        success: true,
        message: `Bulk messaging completed: ${result.successful}/${result.total} delivered successfully`,
        data: result
      });
    } catch (err) {
      const isClientNotReady = err.message.includes('not ready');
      const statusCode = isClientNotReady ? 503 : 500;

      return res.status(statusCode).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * POST /api/logout
   * Explicitly disconnects and resets the WhatsApp session
   */
  async logout(req, res) {
    try {
      const result = await whatsappService.logout();
      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * GET /api/reset-session
   * Completely wipes local session cache and re-generates fresh QR code
   */
  async resetSession(req, res) {
    try {
      // Wait for profile cleanup so the UI never reports a successful reset
      // while Windows still has the WhatsApp Chrome profile locked.
      await whatsappService.resetSession();

      if (req.query.format === 'html') {
        return res.redirect('/');
      }

      return res.status(200).json({
        success: true,
        message: 'Session reset initiated. Generating fresh QR code...'
      });
    } catch (err) {
      console.error('[WhatsAppController] Reset session failed:', err);
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
}

module.exports = new WhatsAppController();

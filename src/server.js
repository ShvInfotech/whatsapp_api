const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const apiRoutes = require('./routes/apiRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const whatsappService = require('./services/whatsappService');
const instanceService = require('./services/instanceService');
const requireAdmin = require('./middlewares/adminAuthMiddleware');
const { authenticate, createSession, verifySession, publicAdmin, resetPassword } = require('./services/adminAuthService');
const userController = require('./controllers/userController');
const requireUser = require('./middlewares/userAuthMiddleware');
const { closeDatabase } = require('./services/databaseService');

function createApp() {
  const app = express();

  // Basic Middlewares
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static Assets (Dashboard Web UI)
  app.use(express.static(path.join(__dirname, '../public')));

  // Dashboard & Documentation Routes
  app.get(['/', '/dashboard', '/index.php', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.get(['/scan', '/scan.html'], (req, res) => {
    res.sendFile(path.join(__dirname, '../public/scan.html'));
  });

  app.get(['/user', '/user.html'], (req, res) => {
    res.sendFile(path.join(__dirname, '../public/user.html'));
  });

  app.get('/API_DOCS.md', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../API_DOCS.md'));
  });

  // Only these authentication endpoints are public.
  app.post('/api/auth/login', async (req, res) => {
    try {
      const admin = await authenticate(req.body.username, req.body.password);
      if (!admin) return res.status(401).json({ success: false, error: 'Invalid username or password.' });
      res.cookie('safevault_admin_session', createSession(admin), {
        httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 8 * 60 * 60 * 1000
      });
      return res.json({ success: true, data: publicAdmin(admin) });
    } catch (_) {
      return res.status(500).json({ success: false, error: 'Unable to verify administrator account.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('safevault_admin_session', { httpOnly: true, sameSite: 'lax', secure: req.secure });
    res.json({ success: true });
  });

  app.post('/api/user-auth/register', (req, res) => userController.register(req, res));
  app.post('/api/user-auth/login', (req, res) => userController.login(req, res));
  app.post('/api/user-auth/logout', (req, res) => userController.logout(req, res));
  app.get('/api/user-auth/me', requireUser, (req, res) => userController.me(req, res));

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const changed = await resetPassword(req.body);
      if (!changed) return res.status(400).json({ success: false, error: 'Recovery details are invalid, or the new password is too short.' });
      res.clearCookie('safevault_admin_session', { httpOnly: true, sameSite: 'lax', secure: req.secure });
      return res.json({ success: true, message: 'Password updated. Please login with your new password.' });
    } catch (_) {
      return res.status(500).json({ success: false, error: 'Unable to update password.' });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const item = (req.headers.cookie || '').split(';').map((value) => value.trim()).find((value) => value.startsWith('safevault_admin_session='));
    const admin = verifySession(item && decodeURIComponent(item.slice('safevault_admin_session='.length)));
    if (!admin) return res.status(401).json({ success: false });
    return res.json({ success: true, data: publicAdmin(admin) });
  });

  // Root Health Check JSON Endpoint
  app.get('/api/health', requireAdmin, (req, res) => {
    res.json({
      service: 'Safe Vault WhatsApp REST API',
      version: '1.0.0',
      status: 'online',
      endpoints: {
        dashboard: '/',
        status: '/api/status',
        qr: '/api/qr',
        sendMessage: '/api/send-message',
        sendBulk: '/api/send-bulk',
        resetSession: '/api/reset-session'
      }
    });
  });

  // Mount API routes
  app.use('/api', apiRoutes);

  // 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function startServer() {
  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log('====================================================');
    console.log(` Safe Vault WhatsApp API running on port ${config.port}`);
    console.log(` Status endpoint: http://localhost:${config.port}/api/status`);
    console.log(` QR Code preview: http://localhost:${config.port}/api/qr`);
    console.log('====================================================');
  });

  // Initialize Multi-Instance WhatsApp Manager
  instanceService.initAll().catch((err) => {
    console.error('[Server] Failed to initialize Multi-Instance Service:', err);
  });

  // Initialize WhatsApp Web Client asynchronously (legacy default)
  whatsappService.initialize().catch((err) => {
    console.error('[Server] Failed to initialize WhatsApp Service:', err);
  });

  // Graceful Shutdown Handler
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
    
    server.close(async () => {
      console.log('[Server] HTTP Server closed.');
      await Promise.allSettled([
        whatsappService.destroy(),
        instanceService.destroyAll(),
        closeDatabase()
      ]);
      console.log('[Server] Cleanup complete. Exiting.');
      process.exit(0);
    });

    // Force exit if shutdown hangs after 10s
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught Exception thrown:', err);
  });

  return { app, server };
}

module.exports = {
  createApp,
  startServer
};

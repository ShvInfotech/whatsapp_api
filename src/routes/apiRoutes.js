const express = require('express');
const router = express.Router();
const sendBuddyController = require('../controllers/sendBuddyController');
const instanceController = require('../controllers/instanceController');
const whatsappController = require('../controllers/whatsappController');
const requireAdmin = require('../middlewares/adminAuthMiddleware');
const requireUser = require('../middlewares/userAuthMiddleware');
const userController = require('../controllers/userController');

/**
 * ====================================================================
 * PUBLIC & SEND-BUDDY COMPATIBLE ENDPOINTS (No Admin Cookie Required)
 * Authenticated via instance_id + access_token parameters
 * ====================================================================
 */

// SendBuddy API: GET & POST /api/send?number=...&type=text&message=...&instance_id=...&access_token=...
router.get('/send', (req, res) => sendBuddyController.handleSend(req, res));
router.post('/send', (req, res) => sendBuddyController.handleSend(req, res));

// Public client QR scan endpoint (used by /scan.html)
router.get('/public/instance-qr', (req, res) => instanceController.publicQr(req, res));

// Registered user endpoints. They are intentionally separate from admin routes.
router.get('/user/instances', requireUser, (req, res) => userController.instances(req, res));
router.get('/user/instances/:id/qr', requireUser, (req, res) => userController.qr(req, res));
router.post('/user/instances/:id/reset', requireUser, (req, res) => userController.reset(req, res));
router.post('/user/instances/:id/send-message', requireUser, (req, res) => userController.sendMessage(req, res));
router.post('/user/instances/:id/send-bulk', requireUser, (req, res) => userController.sendBulk(req, res));


/**
 * ====================================================================
 * PROTECTED ADMIN ENDPOINTS (Requires Administrator Cookie Session)
 * ====================================================================
 */
router.use(requireAdmin);

router.get('/admin/users', (req, res) => userController.adminList(req, res));

// Multi-Instance Management Routes
router.get('/instances', (req, res) => instanceController.list(req, res));
router.post('/instances', (req, res) => instanceController.create(req, res));
router.get('/instances/:id/qr', (req, res) => instanceController.getQr(req, res));
router.post('/instances/:id/reset', (req, res) => instanceController.reset(req, res));
router.delete('/instances/:id', (req, res) => instanceController.delete(req, res));

// Legacy Single-Instance Compatibility Routes
router.get('/status', (req, res) => whatsappController.getStatus(req, res));
router.get('/qr', (req, res) => whatsappController.getQrCode(req, res));
router.get('/reset-session', (req, res) => whatsappController.resetSession(req, res));
router.post('/reset-session', (req, res) => whatsappController.resetSession(req, res));
router.post('/send-message', (req, res) => whatsappController.sendMessage(req, res));
router.post('/send-bulk', (req, res) => whatsappController.sendBulk(req, res));
router.post('/logout', (req, res) => whatsappController.logout(req, res));

module.exports = router;

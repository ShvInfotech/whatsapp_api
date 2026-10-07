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

// Public Template Dispatch API for E-Commerce / Webhooks
router.post('/send-template', (req, res) => sendBuddyController.handleSendTemplate(req, res));
router.get('/send-template', (req, res) => sendBuddyController.handleSendTemplate(req, res));

// Public client QR scan endpoint (used by /scan.html)
router.get('/public/instance-qr', (req, res) => instanceController.publicQr(req, res));

/**
 * ====================================================================
 * REGISTERED USER WORKSPACE ENDPOINTS (Requires User Session)
 * ====================================================================
 */

// Instances
router.get('/user/instances', requireUser, (req, res) => userController.instances(req, res));
router.get('/user/instances/:id/qr', requireUser, (req, res) => userController.qr(req, res));
router.post('/user/instances/:id/reset', requireUser, (req, res) => userController.reset(req, res));
router.post('/user/instances/:id/send-message', requireUser, (req, res) => userController.sendMessage(req, res));
router.post('/user/instances/:id/send-bulk', requireUser, (req, res) => userController.sendBulk(req, res));
<<<<<<< HEAD
router.post('/user/instances/:id/send-template', requireUser, (req, res) => userController.sendTemplateMessage(req, res));
=======
>>>>>>> 48c6ca5121ffd90265c7fc88b6993d1e2da27cd1

// Message Templates
router.get('/user/templates', requireUser, (req, res) => userController.getTemplates(req, res));
router.post('/user/templates', requireUser, (req, res) => userController.createTemplate(req, res));
router.put('/user/templates/:id', requireUser, (req, res) => userController.updateTemplate(req, res));
router.delete('/user/templates/:id', requireUser, (req, res) => userController.deleteTemplate(req, res));

// Delivery Logs & Statistics
router.get('/user/logs', requireUser, (req, res) => userController.getLogs(req, res));
router.delete('/user/logs', requireUser, (req, res) => userController.clearLogs(req, res));
router.get('/user/stats', requireUser, (req, res) => userController.getStats(req, res));

// Plan Upgrade & Credit Recharge (Razorpay Integrated)
router.get('/user/plans', requireUser, (req, res) => userController.getPlans(req, res));
router.post('/user/upgrade-plan', requireUser, (req, res) => userController.upgradePlan(req, res));
router.post('/user/create-payment-order', requireUser, (req, res) => userController.createPaymentOrder(req, res));
router.post('/user/verify-payment', requireUser, (req, res) => userController.verifyPayment(req, res));

// User Profile & Account Settings
router.post('/user/profile', requireUser, (req, res) => userController.updateProfile(req, res));
router.post('/user/change-password', requireUser, (req, res) => userController.changePassword(req, res));


const adminController = require('../controllers/adminController');

/**
 * ====================================================================
 * PROTECTED ADMIN ENDPOINTS (Requires Administrator Cookie Session)
 * ====================================================================
 */
router.use(requireAdmin);

// Master SaaS Dashboard & Management
router.get('/admin/dashboard-stats', (req, res) => adminController.getDashboardStats(req, res));
router.get('/admin/users', (req, res) => adminController.getUsers(req, res));
router.post('/admin/users/credits', (req, res) => adminController.updateUserCredits(req, res));
router.post('/admin/users/plan', (req, res) => adminController.updateUserPlan(req, res));
router.post('/admin/users/status', (req, res) => adminController.toggleUserStatus(req, res));
router.post('/admin/users/reset-session', (req, res) => adminController.resetUserSession(req, res));
router.delete('/admin/users/:id', (req, res) => adminController.deleteUser(req, res));
router.get('/admin/transactions', (req, res) => adminController.getTransactions(req, res));
router.get('/admin/instances', (req, res) => adminController.getInstances(req, res));
router.get('/admin/plans-config', (req, res) => adminController.getPlansConfig(req, res));

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
router.post('/logout', (req, res) => whatsappController.logout(req, res));

module.exports = router;

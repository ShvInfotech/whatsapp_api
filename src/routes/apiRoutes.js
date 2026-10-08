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
router.post('/user/instances/:id/send-template', requireUser, (req, res) => userController.sendTemplateMessage(req, res));

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


// TEMPORARY DIAGNOSTIC (remove after debugging): inspect caption payload
router.get('/_debug/caption', async (req, res) => {
  try {
    const instanceService = require('../services/instanceService');
    const whatsappService = require('../services/whatsappService');
    let client = null;
    for (const [, state] of instanceService.instances.entries()) {
      if (state.client && state.client.pupPage && state.status === 'CONNECTED') { client = state.client; break; }
    }
    if (!client && whatsappService.client && whatsappService.client.pupPage) client = whatsappService.client;
    if (!client) return res.status(503).json({ ok: false, error: 'No connected WhatsApp client' });

    const op = req.query.op || 'probe';
    if (op !== 'probe') {
      const r = await client.pupPage.evaluate((operation) => {
        if (operation === 'start') {
          if (!window.__probe) {
            window.__probe = { log: [] };
            const rec = (entry) => { if (window.__probe.log.length < 40) window.__probe.log.push(entry); };

            const wjs = window.WWebJS;
            const origSend = wjs.sendMessage;
            window.__probe.restoreSend = () => { wjs.sendMessage = origSend; };
            wjs.sendMessage = async function (chat, content, options) {
              const entry = { step: 'WWebJS.sendMessage', hasMedia: !!(options && options.media), caption: options && options.caption, contentType: typeof content };
              try {
                const res = await origSend.apply(this, arguments);
                entry.returnType = res === null ? 'null' : res === undefined ? 'undefined' : typeof res;
                entry.msgId = res && res.id && res.id._serialized;
                entry.msgCaption = res && res.caption;
                return res;
              } catch (e) {
                entry.error = e.message;
                throw e;
              } finally { rec(entry); }
            };

            const chatMod = window.require('WAWebSendMsgChatAction');
            const origAdd = chatMod.addAndSendMsgToChat;
            window.__probe.restoreAdd = () => { chatMod.addAndSendMsgToChat = origAdd; };
            chatMod.addAndSendMsgToChat = function (chat, message) {
              rec({
                step: 'addAndSendMsgToChat',
                caption: message && message.caption,
                type: message && message.type,
                isCaptionByUser: message && message.isCaptionByUser,
                msgOwnToJSON: message ? Object.prototype.hasOwnProperty.call(message, 'toJSON') : null,
                msgToJSONType: message ? typeof message.toJSON : null,
                msgOwnPropsKey: message ? Object.prototype.hasOwnProperty.call(message, '__props') : null,
                msgPropsIsArray: message ? Array.isArray(message.__props) : null,
                msgOwnAttributes: message ? Object.prototype.hasOwnProperty.call(message, 'attributes') : null,
                msgOwnCollection: message ? Object.prototype.hasOwnProperty.call(message, 'collection') : null
              });
              return origAdd.apply(this, arguments);
            };

            const gen = window.require('WAWebE2EProtoGenerator');
            window.__probe.restoreProto = () => {
              for (const k in gen) { if (window.__probe.genOrig[k]) gen[k] = window.__probe.genOrig[k]; }
            };
            window.__probe.genOrig = {};
            for (const k in gen) {
              if (typeof gen[k] !== 'function') continue;
              window.__probe.genOrig[k] = gen[k];
              const origFn = gen[k];
              gen[k] = function (json) {
                const res = origFn.apply(this, arguments);
                try {
                  if (k === 'createMsgProtobuf') {
                    const a0 = json;
                    let tj = null, tjErr = null;
                    try { tj = (a0 && typeof a0.toJSON === 'function') ? a0.toJSON() : null; } catch (e) { tjErr = e.message; }
                    rec({
                      step: 'createMsgProtobuf.detail',
                      arg0Ctor: a0 && a0.constructor ? a0.constructor.name : null,
                      arg0IsModel: !!(a0 && a0.attributes),
                      arg0Caption: a0 && a0.caption,
                      arg0AttrCaption: a0 && a0.attributes ? a0.attributes.caption : 'no-attributes',
                      ownHasPropsKey: a0 ? Object.prototype.hasOwnProperty.call(a0, '__props') : null,
                      propsIsArray: a0 ? Array.isArray(a0.__props) : null,
                      propsLen: a0 && a0.__props && a0.__props.length ? a0.__props.length : null,
                      propsHasCaption: a0 && Array.isArray(a0.__props) ? a0.__props.indexOf('caption') !== -1 : null,
                      propsSample: a0 && Array.isArray(a0.__props) ? a0.__props.slice(0, 20) : null,
                      ownHasToJSON: a0 ? Object.prototype.hasOwnProperty.call(a0, 'toJSON') : null,
                      toJSONSrc: a0 && a0.toJSON ? String(a0.toJSON).slice(0, 160) : null,
                      toJSONErr: tjErr,
                      toJSONKeys: tj ? Object.keys(tj).slice(0, 25) : null,
                      toJSONCaption: tj ? tj.caption : 'no-toJSON',
                      toJSONType: tj ? tj.type : null,
                      toJSONHasCaptionKey: tj ? Object.prototype.hasOwnProperty.call(tj, 'caption') : null,
                      arg1Type: typeof arguments[1],
                      arg1Keys: arguments[1] && typeof arguments[1] === 'object' ? Object.keys(arguments[1]).slice(0, 20) : null
                    });
                  }
                  const inner = res && (res.imageMessage || res.videoMessage || res.documentMessage);
                  rec({
                    step: 'protoGen:' + k,
                    arg0Type: json && json.type,
                    arg0Caption: json && json.caption,
                    arg1Caption: arguments[1] && arguments[1].caption,
                    protoCaption: inner ? inner.caption : (res && typeof res.conversation === 'string' ? res.conversation : null),
                    protoKeys: res && typeof res === 'object' ? Object.keys(res) : typeof res
                  });
                } catch (e) { rec({ step: 'protoGen:' + k, error: e.message }); }
                return res;
              };
            }
          }
          window.__probe.log.length = 0;
          return { installed: true };
        }
        if (operation === 'check') {
          const wjs = window.WWebJS;
          const chatMod = window.require('WAWebSendMsgChatAction');
          const gen = window.require('WAWebE2EProtoGenerator');
          return {
            hasProbe: !!window.__probe,
            sendPatched: wjs ? wjs.sendMessage.__probeMark === true : false,
            sendSrc: wjs ? String(wjs.sendMessage).slice(0, 80) : null,
            addSrc: String(chatMod.addAndSendMsgToChat).slice(0, 80),
            protoSrc: String(gen.getProtobufMessage).slice(0, 80)
          };
        }
        if (operation === 'find') {
          const needle = window.__capNeedle || 'E2E_CAPTION_TEST';
          const cols = window.require('WAWebCollections');
          const col = cols.Msg || cols.MsgCollection;
          const models = col && col.models ? col.models : [];
          const hits = [];
          for (let i = models.length - 1; i >= 0 && hits.length < 8; i--) {
            const m = models[i];
            const cap = typeof m.caption === 'string' ? m.caption : '';
            const body = typeof m.body === 'string' ? m.body : '';
            if ((cap && cap.indexOf(needle) !== -1) || (body && body.indexOf(needle) !== -1)) {
              hits.push({
                id: m.id && m.id._serialized, type: m.type, caption: cap,
                ack: m.ack, t: m.t, hasMediaData: !!m.mediaData
              });
            }
          }
          return { total: models.length, hits };
        }
        if (operation === 'get') {
          const log = window.__probe ? window.__probe.log.slice() : null;
          if (window.__probe) window.__probe.log.length = 0;
          return { log };
        }
        if (operation === 'last') {
          return window.WWebJS.getChat(window.__capJid || '919714920969@c.us', { getAsModel: false }).then((chat) => {
            const models = (chat && chat.msgs && chat.msgs.models) ? chat.msgs.models : [];
            return models.slice(-6).reverse().map((m) => ({
              id: m.id && m.id._serialized,
              fromMe: m.id && m.id.fromMe,
              type: m.type,
              caption: m.caption,
              bodyType: typeof m.body,
              bodyPrefix: typeof m.body === 'string' ? m.body.slice(0, 40) : null,
              ack: m.ack,
              t: m.t
            }));
          });
        }
        if (operation === 'restore') {
          const p = window.__probe;
          if (p) {
            try { p.restoreSend && p.restoreSend(); p.restoreAdd && p.restoreAdd(); p.restoreProto && p.restoreProto(); } catch (_) {}
            window.__probe = null;
          }
          return { restored: true };
        }
        return { unknown: operation };
      }, op);
      return res.json({ ok: true, op, r });
    }

    const out = await client.pupPage.evaluate(async (chatJid) => {
      const r = {};
      try {
        r.wwebjs = {
          available: !!window.WWebJS,
          sendMsgPatched: !!(window.WWebJS && window.WWebJS.__sendMsgPatched),
          mediaProcessPatched: !!(window.WWebJS && window.WWebJS.__mediaProcessPatched)
        };
        const chatMod = window.require('WAWebSendMsgChatAction');
        r.chatActionKeys = Object.keys(chatMod || {});
        r.addAndSendSrc = String(chatMod.addAndSendMsgToChat).slice(0, 200);

        const orig = chatMod.addAndSendMsgToChat;
        let captured = null;
        chatMod.addAndSendMsgToChat = function (chat, message) {
          captured = message;
          return [Promise.resolve(null), Promise.resolve({ messageSendResult: null })];
        };
        try {
          const chat = await window.WWebJS.getChat(chatJid, { getAsModel: false });
          const media = {
            mimetype: 'image/jpeg',
            filename: 'probe.jpg',
            data: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=='
          };
          await window.WWebJS.sendMessage(chat, '', { media, caption: 'DEBUG_CAPTION_XYZ' });
        } finally {
          chatMod.addAndSendMsgToChat = orig;
        }

        if (!captured) { r.captured = null; return r; }

        const summarize = (m) => ({
          caption: m.caption,
          type: m.type,
          isCaptionByUser: m.isCaptionByUser,
          bodyPrefix: typeof m.body === 'string' ? m.body.slice(0, 40) : typeof m.body,
          hasMediaData: !!m.mediaData,
          hasMediaObject: !!m.mediaObject,
          hasAttributesKey: !!m.attributes,
          ownKeys: Object.keys(m).slice(0, 60)
        });
        r.captured = summarize(captured);

        try {
          const Msg = window.require('WAWebMsgModel').Msg;
          const model = new Msg(captured);
          r.model = summarize(model);
          const json = model.toJSON ? model.toJSON() : null;
          r.modelJson = json ? {
            caption: json.caption,
            type: json.type,
            isCaptionByUser: json.isCaptionByUser,
            bodyPrefix: typeof json.body === 'string' ? json.body.slice(0, 40) : typeof json.body,
            hasMediaData: !!json.mediaData,
            mimetype: json.mimetype
          } : null;
          try {
            const gen = window.require('WAWebE2EProtoGenerator');
            const fakeMM = {
              url: 'https://x', directPath: 'x', encFilehash: 'aa', mediaKey: 'bb',
              mediaKeyTimestamp: 1, filehash: 'cc', type: 'image', mimetype: 'image/jpeg',
              filename: 'p.jpg', width: 1, height: 1
            };
            const proto = gen.getProtobufMessage(model.toJSON(), fakeMM);
            r.proto = proto && proto.imageMessage
              ? { caption: proto.imageMessage.caption, mimetype: proto.imageMessage.mimetype }
              : { keys: proto ? Object.keys(proto) : null };
          } catch (e) { r.protoError = e.message; }
        } catch (e) { r.modelError = e.message; }
      } catch (e) { r.error = e.message; }
      return r;
    }, req.query.jid || '919714920969@c.us');

    return res.json({ ok: true, out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});


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

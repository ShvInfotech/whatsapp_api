const fs = require('fs');
const path = require('path');

function applyCaptionPatch() {
  try {
    const targetPath = path.join(__dirname, 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'Utils.js');

    if (!fs.existsSync(targetPath)) {
      console.warn('[Patch] Warning: Utils.js not found at:', targetPath);
      return false;
    }

    let content = fs.readFileSync(targetPath, 'utf8');
    let modified = false;

    // Patch 1: Remove bad body overwrite if present
    const badBodyLine = 'message.body = options.caption;';
    if (content.includes(badBodyLine)) {
      content = content.replace(badBodyLine, '// body is media preview data, do not overwrite with caption');
      modified = true;
      console.log('[Patch 1] Removed message.body = options.caption');
    }

    // Patch 2: mediaOptions.set('caption', ...)
    const mediaSetTarget = 'mediaOptions.caption = options.caption;';
    const mediaSetReplacement =
      "mediaOptions.caption = options.caption;\n" +
      "            if (typeof mediaOptions.set === 'function' && options.caption) {\n" +
      "                mediaOptions.set('caption', options.caption);\n" +
      "            }";
    if (content.includes(mediaSetTarget) && !content.includes("mediaOptions.set('caption', options.caption)")) {
      content = content.replace(mediaSetTarget, mediaSetReplacement);
      modified = true;
      console.log('[Patch 2] Added mediaOptions.set("caption", options.caption)');
    }

    // Patch 3: Pre-compute _mediaJson to strip bad caption before spreading
    const badSpread = '...(mediaOptions.toJSON ? mediaOptions.toJSON() : {}),';
    const goodSpread = "..._mediaJson,";
    const mediaJsonPrep =
      "        // Build mediaOptions JSON, but strip caption so it doesn't overwrite user's text\n" +
      "        const _mediaJson = mediaOptions.toJSON ? mediaOptions.toJSON() : {};\n" +
      "        if ('caption' in _mediaJson && (!_mediaJson.caption || typeof _mediaJson.caption !== 'string' || _mediaJson.caption.startsWith('data:'))) {\n" +
      "            delete _mediaJson.caption;\n" +
      "        }\n\n" +
      "        const message = {";

    const msgStart = "        const message = {";

    if (content.includes(badSpread) && !content.includes('const _mediaJson =')) {
      content = content.replace(badSpread, goodSpread);
      content = content.replace(msgStart, mediaJsonPrep);
      modified = true;
      console.log('[Patch 3] Replaced mediaOptions.toJSON spread with pre-computed _mediaJson');
    }

    // Patch 4: Always re-apply user caption after message construction
    if (!content.includes("Always re-apply user caption")) {
      const captionGuardOld = `        if (options && options.caption) {
            message.caption = options.caption;`;

      const captionGuardNew =
        "        // Always re-apply user caption — this is the definitive fix so no spread can overwrite it\n" +
        "        if (options && options.caption && typeof options.caption === 'string' && !options.caption.startsWith('data:')) {\n" +
        "            message.caption = options.caption;";

      if (content.includes(captionGuardOld)) {
        content = content.replace(captionGuardOld, captionGuardNew);
        modified = true;
        console.log('[Patch 4] Strengthened caption guard after message construction');
      } else {
        const insertTarget = `if (botOptions) {\n            delete message.canonicalUrl;\n        }`;
        const insertion =
          "if (botOptions) {\n            delete message.canonicalUrl;\n        }\n\n" +
          "        // Always re-apply user caption — this is the definitive fix so no spread can overwrite it\n" +
          "        if (options && options.caption && typeof options.caption === 'string' && !options.caption.startsWith('data:')) {\n" +
          "            message.caption = options.caption;\n" +
          "            message.isCaptionByUser = true;\n" +
          "            if (message.mediaData) {\n" +
          "                message.mediaData.caption = options.caption;\n" +
          "                if (typeof message.mediaData.set === 'function') {\n" +
          "                    message.mediaData.set('caption', options.caption);\n" +
          "                }\n" +
          "            }\n" +
          "        }";
        if (content.includes(insertTarget)) {
          content = content.replace(insertTarget, insertion);
          modified = true;
          console.log('[Patch 4] Added caption guard after botOptions block');
        }
      }
    }

    // Patch 5: E2E Protobuf Generator & MsgModel hook directly in Utils.js
    const oldSendMsgInvocation = `        const [msgPromise, sendMsgResultPromise] = window
            .require('WAWebSendMsgChatAction')
            .addAndSendMsgToChat(chat, message);
        await msgPromise;`;

    const newSendMsgInvocation = `        // Ensure E2E Protobuf Generator preserves caption on outgoing image/media messages
        try {
            if (!window.WWebJS.__captionByMsgKey) window.WWebJS.__captionByMsgKey = new Map();
            if (options && options.caption && typeof options.caption === 'string' && !options.caption.startsWith('data:')) {
                const cleanCap = options.caption.trim();
                if (newMsgKey && newMsgKey._serialized) window.WWebJS.__captionByMsgKey.set(newMsgKey._serialized, cleanCap);
                if (newMsgKey && newMsgKey.id) window.WWebJS.__captionByMsgKey.set(newMsgKey.id, cleanCap);
                window.WWebJS.__lastCaption = cleanCap;
                window.WWebJS.__lastCaptionTime = Date.now();
            }

            const gen = window.require ? window.require('WAWebE2EProtoGenerator') : null;
            if (gen && !gen.__captionHookInstalled) {
                gen.__captionHookInstalled = true;
                for (const k of ['createMsgProtobuf', 'getProtobufMessage']) {
                    if (typeof gen[k] === 'function') {
                        const origGen = gen[k];
                        gen[k] = function(...genArgs) {
                            const protoRes = origGen.apply(this, genArgs);
                            try {
                                const targetMsg = protoRes && (protoRes.imageMessage || protoRes.videoMessage || protoRes.documentMessage);
                                if (targetMsg && !targetMsg.caption) {
                                    const a0 = genArgs[0];
                                    const mKey = (a0 && a0.id && (a0.id._serialized || a0.id.id || a0.id)) || (a0 && a0.__x_id && (a0.__x_id._serialized || a0.__x_id.id)) || null;
                                    let cap = null;
                                    if (window.WWebJS && window.WWebJS.__captionByMsgKey && mKey) {
                                        cap = window.WWebJS.__captionByMsgKey.get(mKey) || window.WWebJS.__captionByMsgKey.get(String(mKey));
                                    }
                                    if (!cap && a0) {
                                        cap = (typeof a0.caption === 'string' && !a0.caption.startsWith('data:') && a0.caption.trim()) ||
                                              (a0.attributes && typeof a0.attributes.caption === 'string' && a0.attributes.caption.trim()) ||
                                              (a0.mediaData && typeof a0.mediaData.caption === 'string' && a0.mediaData.caption.trim()) ||
                                              null;
                                    }
                                    if (!cap && genArgs[1] && typeof genArgs[1].caption === 'string' && genArgs[1].caption.trim()) {
                                        cap = genArgs[1].caption.trim();
                                    }
                                    if (!cap && window.WWebJS && window.WWebJS.__lastCaption && (Date.now() - (window.WWebJS.__lastCaptionTime || 0) < 120000)) {
                                        cap = window.WWebJS.__lastCaption;
                                    }
                                    if (cap) {
                                        targetMsg.caption = cap;
                                    }
                                }
                            } catch (_) {}
                            return protoRes;
                        };
                    }
                }
            }
        } catch (_) {}

        const [msgPromise, sendMsgResultPromise] = window
            .require('WAWebSendMsgChatAction')
            .addAndSendMsgToChat(chat, message);

        if (msgPromise && typeof msgPromise.then === 'function') {
            msgPromise.then((msgModel) => {
                if (msgModel && options && options.caption && typeof options.caption === 'string') {
                    try {
                        const cap = options.caption.trim();
                        msgModel.caption = cap;
                        msgModel.isCaptionByUser = true;
                        if (typeof msgModel.set === 'function') {
                            msgModel.set('caption', cap);
                            msgModel.set('isCaptionByUser', true);
                        }
                        if (msgModel.attributes) {
                            msgModel.attributes.caption = cap;
                            msgModel.attributes.isCaptionByUser = true;
                        }
                        if (msgModel.mediaData) {
                            msgModel.mediaData.caption = cap;
                            if (typeof msgModel.mediaData.set === 'function') {
                                msgModel.mediaData.set('caption', cap);
                            }
                        }
                    } catch (_) {}
                }
            }).catch(() => {});
        }
        await msgPromise;`;

    if (!content.includes("__captionHookInstalled")) {
      if (content.includes(oldSendMsgInvocation)) {
        content = content.replace(oldSendMsgInvocation, newSendMsgInvocation);
        modified = true;
        console.log('[Patch 5] Injected E2E Protobuf Generator hook and MsgModel preservation into Utils.js');
      }
    }

    if (modified) {
      fs.writeFileSync(targetPath, content, 'utf8');
      console.log('[Patch] Utils.js patched successfully for caption preservation!');
      return true;
    } else {
      console.log('[Patch] Utils.js is already fully patched.');
      return true;
    }
  } catch (err) {
    console.error('[Patch] Error while applying caption patch:', err.message);
    return false;
  }
}


function applySocketInitPatch() {
  try {
    // 1. Patch AuthStore.js: prevent "Cannot read properties of null (reading 'Socket')"
    const authStorePath = path.join(__dirname, 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'AuthStore', 'AuthStore.js');
    if (fs.existsSync(authStorePath)) {
      const safeAuthStore = `'use strict';

exports.ExposeAuthStore = () => {
    window.AuthStore = {};
    const safeReq = (name) => {
        try {
            return (typeof window.require === 'function') ? window.require(name) : null;
        } catch (_) {
            return null;
        }
    };
    const ws = safeReq('WAWebSocketModel') || safeReq('WAWebBackendSocket');
    window.AuthStore.AppState = ws ? ws.Socket : null;
    const cmd = safeReq('WAWebCmd');
    window.AuthStore.Cmd = cmd ? cmd.Cmd : null;
    const conn = safeReq('WAWebConnModel');
    window.AuthStore.Conn = conn ? conn.Conn : null;
    const offline = safeReq('WAWebOfflineHandler');
    window.AuthStore.OfflineMessageHandler = offline ? offline.OfflineMessageHandler : null;
    window.AuthStore.PairingCodeLinkUtils = safeReq('WAWebAltDeviceLinkingApi') || null;
    window.AuthStore.Base64Tools = safeReq('WABase64') || null;
    window.AuthStore.RegistrationUtils = {
        ...(safeReq('WAWebCompanionRegClientUtils') || {}),
        ...(safeReq('WAWebAdvSignatureApi') || {}),
        ...(safeReq('WAWebUserPrefsInfoStore') || {}),
        ...(safeReq('WAWebSignalStoreApi') || {}),
    };
};
`;
      const current = fs.readFileSync(authStorePath, 'utf8');
      if (current.includes("window.AuthStore.AppState = window.require('WAWebSocketModel').Socket;") || !current.includes("safeReq('WAWebOfflineHandler')")) {
        fs.writeFileSync(authStorePath, safeAuthStore, 'utf8');
        console.log('[Patch] AuthStore.js patched successfully for safe Socket/AppState resolution!');
      } else {
        console.log('[Patch] AuthStore.js already patched.');
      }
    }

    // 2. Patch Client.js: ensure quick startup without auth timeout and safe needAuthentication
    const clientPath = path.join(__dirname, 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');
    if (fs.existsSync(clientPath)) {
      let clientContent = fs.readFileSync(clientPath, 'utf8');
      let clientModified = false;

      // Fix 2a: Robust wait loop with 90s timeout + DOM [data-ref]/canvas detection for high-load servers
      const oldWait30 = `        if (
            this.options.authTimeoutMs === undefined ||
            this.options.authTimeoutMs == 0
        ) {
            this.options.authTimeoutMs = 30000;
        }
        let start = Date.now();
        let timeout = this.options.authTimeoutMs;
        let res = false;
        while (start > Date.now() - timeout) {
            res = await this.pupPage.evaluate(
                'window.Debug?.VERSION != undefined',
            );
            if (res) {
                break;
            }
            await new Promise((r) => setTimeout(r, 200));
        }`;

      const robustWait90 = `        if (
            this.options.authTimeoutMs === undefined ||
            this.options.authTimeoutMs == 0
        ) {
            this.options.authTimeoutMs = 90000;
        }
        let start = Date.now();
        let timeout = this.options.authTimeoutMs;
        let res = false;
        while (start > Date.now() - timeout) {
            try {
                res = await this.pupPage.evaluate(() => {
                    return Boolean(
                        (typeof window.Debug !== 'undefined' && window.Debug?.VERSION != undefined) ||
                        document.querySelector('div[data-ref]') ||
                        document.querySelector('[data-ref]') ||
                        document.querySelector('canvas') ||
                        document.querySelector('[data-testid="qrcode"]')
                    );
                });
            } catch (_) {
                res = false;
            }
            if (res) {
                break;
            }
            await new Promise((r) => setTimeout(r, 250));
        }`;

      if (clientContent.includes(oldWait30)) {
        clientContent = clientContent.replace(oldWait30, robustWait90);
        clientModified = true;
        console.log('[Patch] Client.js upgraded to robust 90s wait loop with DOM QR detection.');
      }

      // Fix 2b: Safeguard needAuthentication in Client.js
      const oldNeedAuth = `        const needAuthentication = await this.pupPage.evaluate(async () => {
            let state = window.require('WAWebSocketModel').Socket.state;`;

      const safeNeedAuth = `        const needAuthentication = await this.pupPage.evaluate(async () => {
            const getSocket = () => {
                try {
                    return (typeof window.require === 'function')
                        ? (window.require('WAWebSocketModel')?.Socket || window.require('WAWebBackendSocket')?.Socket || null)
                        : null;
                } catch (_) {
                    return null;
                }
            };
            let socket = getSocket();
            if (!socket) {
                return true;
            }
            let state = socket.state;`;

      if (clientContent.includes(oldNeedAuth)) {
        clientContent = clientContent.replace(oldNeedAuth, safeNeedAuth);
        clientContent = clientContent.replace(
          "window.require('WAWebSocketModel').Socket.on(",
          "socket.on("
        );
        clientContent = clientContent.replace(
          "window.require('WAWebSocketModel').Socket.off(",
          "socket.off("
        );
        clientContent = clientContent.replace(
          "state = window.require('WAWebSocketModel').Socket.state;",
          "state = (getSocket() || socket)?.state;"
        );
        clientModified = true;
        console.log('[Patch] Client.js patched: needAuthentication now uses safe socket resolution.');
      }

      // Fix 2c: Safe event listeners inside inject
      const oldInjectEvents = `        await this.pupPage.evaluate(() => {
            window
                .require('WAWebSocketModel')
                .Socket.on('change:state', (_AppState, state) => {
                    window.onAuthAppStateChangedEvent(state);
                });
            window
                .require('WAWebSocketModel')
                .Socket.on('change:hasSynced', () => {
                    window.onAppStateHasSyncedEvent();
                });
            const Cmd = window.require('WAWebCmd').Cmd;
            Cmd.on('offline_progress_update_from_bridge', () => {
                window.onOfflineProgressUpdateEvent(
                    window.AuthStore.OfflineMessageHandler.getOfflineDeliveryProgress(),
                );
            });
            Cmd.on('logout', async () => {
                await window.onLogoutEvent();
            });
            Cmd.on('logout_from_bridge', async () => {
                await window.onLogoutEvent();
            });
        });`;

      const safeInjectEvents = `        await this.pupPage.evaluate(() => {
            const socket = (typeof window.require === 'function' ? (window.require('WAWebSocketModel')?.Socket || window.require('WAWebBackendSocket')?.Socket) : null) || window.AuthStore?.AppState;
            if (socket) {
                socket.on('change:state', (_AppState, state) => {
                    window.onAuthAppStateChangedEvent(state);
                });
                socket.on('change:hasSynced', () => {
                    window.onAppStateHasSyncedEvent();
                });
            }
            const Cmd = (typeof window.require === 'function' ? window.require('WAWebCmd')?.Cmd : null) || window.AuthStore?.Cmd;
            if (Cmd) {
                Cmd.on('offline_progress_update_from_bridge', () => {
                    if (window.AuthStore?.OfflineMessageHandler) {
                        window.onOfflineProgressUpdateEvent(
                            window.AuthStore.OfflineMessageHandler.getOfflineDeliveryProgress(),
                        );
                    }
                });
                Cmd.on('logout', async () => {
                    await window.onLogoutEvent();
                });
                Cmd.on('logout_from_bridge', async () => {
                    await window.onLogoutEvent();
                });
            }
        });`;

      if (clientContent.includes(oldInjectEvents)) {
        clientContent = clientContent.replace(oldInjectEvents, safeInjectEvents);
        clientModified = true;
        console.log('[Patch] Client.js patched: safe inject event listeners applied.');
      }

      // Fix 2d: Safe QR generation with DOM observer + safe retry to prevent Invariant Violation #56356
      const oldQREval = `                await this.pupPage.evaluate(async () => {
                    const registrationInfo =
                        await window.AuthStore.RegistrationUtils.waSignalStore.getRegistrationInfo();
                    const noiseKeyPair =
                        await window.AuthStore.RegistrationUtils.waNoiseInfo.get();
                    const staticKeyB64 = window.AuthStore.Base64Tools.encodeB64(
                        noiseKeyPair.staticKeyPair.pubKey,
                    );
                    const identityKeyB64 =
                        window.AuthStore.Base64Tools.encodeB64(
                            registrationInfo.identityKeyPair.pubKey,
                        );
                    const platform =
                        window.AuthStore.RegistrationUtils.DEVICE_PLATFORM;
                    const getQR = (ref) =>
                        ref +
                        ',' +
                        staticKeyB64 +
                        ',' +
                        identityKeyB64 +
                        ',' +
                        window
                            .require('WAWebUserPrefsMultiDevice')
                            .getADVSecretKey() +
                        ',' +
                        platform;
                    window.onQRChangedEvent(getQR(window.AuthStore.Conn.ref)); // initial qr
                    window.AuthStore.Conn.on('change:ref', (_, ref) => {
                        window.onQRChangedEvent(getQR(ref));
                    }); // future QR changes
                });`;

      const safeQREval = `                await this.pupPage.evaluate(async () => {
                    let lastEmittedQR = null;
                    const emitQR = (qr) => {
                        if (qr && qr !== lastEmittedQR && typeof window.onQRChangedEvent === 'function') {
                            lastEmittedQR = qr;
                            window.onQRChangedEvent(qr);
                        }
                    };

                    // Method 1: Continuous DOM observer for [data-ref] (renders instantly in WhatsApp Web UI)
                    const checkDom = () => {
                        try {
                            const el = document.querySelector('div[data-ref]') || document.querySelector('[data-ref]');
                            if (el) {
                                const val = el.getAttribute('data-ref');
                                if (val) emitQR(val);
                            }
                        } catch (_) {}
                    };
                    checkDom();
                    try {
                        const obs = new MutationObserver(() => checkDom());
                        obs.observe(document.body || document.documentElement, {
                            childList: true,
                            subtree: true,
                            attributes: true,
                            attributeFilter: ['data-ref']
                        });
                    } catch (_) {}

                    // Method 2: Internal WhatsApp Web AuthStore with safe retry to prevent Invariant Violations
                    const pollAuthStore = async () => {
                        for (let attempt = 0; attempt < 30; attempt++) {
                            try {
                                const regUtils = window.AuthStore?.RegistrationUtils;
                                const base64 = window.AuthStore?.Base64Tools;
                                const conn = window.AuthStore?.Conn;
                                if (regUtils?.waSignalStore && regUtils?.waNoiseInfo && base64 && conn) {
                                    const registrationInfo = await regUtils.waSignalStore.getRegistrationInfo();
                                    const noiseKeyPair = await regUtils.waNoiseInfo.get();
                                    if (registrationInfo && noiseKeyPair) {
                                        const staticKeyB64 = base64.encodeB64(noiseKeyPair.staticKeyPair.pubKey);
                                        const identityKeyB64 = base64.encodeB64(registrationInfo.identityKeyPair.pubKey);
                                        const platform = regUtils.DEVICE_PLATFORM;
                                        const advSecret = (typeof window.require === 'function' ? window.require('WAWebUserPrefsMultiDevice')?.getADVSecretKey() : null) || '';
                                        const getQR = (ref) => ref + ',' + staticKeyB64 + ',' + identityKeyB64 + ',' + advSecret + ',' + platform;

                                        if (conn.ref) {
                                            emitQR(getQR(conn.ref));
                                        }
                                        if (!conn.__qrListenerHooked && typeof conn.on === 'function') {
                                            conn.__qrListenerHooked = true;
                                            conn.on('change:ref', (_, ref) => {
                                                if (ref) emitQR(getQR(ref));
                                            });
                                        }
                                        break;
                                    }
                                }
                            } catch (_) {
                                // Ignore early Invariant Violations while stores initialize
                            }
                            await new Promise((r) => setTimeout(r, 500));
                        }
                    };

                    pollAuthStore().catch(() => {});
                });`;

      if (clientContent.includes(oldQREval)) {
        clientContent = clientContent.replace(oldQREval, safeQREval);
        clientModified = true;
        console.log('[Patch] Client.js patched: safe QR generation with DOM observer + retry applied.');
      }

      if (clientModified) {
        fs.writeFileSync(clientPath, clientContent, 'utf8');
        console.log('[Patch] Client.js successfully updated.');
      } else {
        console.log('[Patch] Client.js already patched.');
      }
    }
  } catch (err) {
    console.error('[Patch] Error while applying socket init patch:', err.message);
  }
}

// Apply immediately when loaded
applyCaptionPatch();
applySocketInitPatch();

module.exports = { applyCaptionPatch, applySocketInitPatch };

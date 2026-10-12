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

// Apply immediately when loaded
applyCaptionPatch();

module.exports = { applyCaptionPatch };

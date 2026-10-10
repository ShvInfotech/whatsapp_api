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

    // Patch 1: After message object construction, ensure caption is preserved
    // Find the block: delete message.__x_id; message.id = newMsgKey; ... if (botOptions)
    // We need: message.caption = options.caption (WITHOUT message.body = options.caption)
    const badBodyLine = 'message.body = options.caption;';
    if (content.includes(badBodyLine)) {
      content = content.replace(badBodyLine, '// body is media preview data, do not overwrite with caption');
      modified = true;
      console.log('[Patch] Removed message.body = options.caption (prevents thumbnail overwriting caption)');
    }

    // Patch 2: Ensure caption assignment exists
    const captionAssign = 'message.caption = options.caption;';
    const idPatchBlock = 'delete message.__x_id;';
    if (!content.includes(captionAssign) && content.includes(idPatchBlock)) {
      // Find the delete message.__x_id block and add caption after it
      const insertAfter = 'message.id = newMsgKey;';
      if (content.includes(insertAfter)) {
        content = content.replace(
          insertAfter,
          insertAfter + '\n        if (options && options.caption) {\n            message.caption = options.caption;\n        }'
        );
        modified = true;
        console.log('[Patch] Added message.caption = options.caption after message.id = newMsgKey');
      }
    }

    if (modified) {
      fs.writeFileSync(targetPath, content, 'utf8');
      console.log('[Patch] Utils.js patched successfully for caption preservation!');
      return true;
    } else if (content.includes(captionAssign) && !content.includes(badBodyLine)) {
      return true;
    }
  } catch (err) {
    console.error('[Patch] Error while applying caption patch:', err.message);
  }
  return false;
}

// Apply immediately when loaded
applyCaptionPatch();

module.exports = { applyCaptionPatch };


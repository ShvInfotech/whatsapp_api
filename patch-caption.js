const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'Utils.js');

if (!fs.existsSync(targetPath)) {
  console.error('[Patch] Error: Utils.js not found at:', targetPath);
  process.exit(1);
}

let content = fs.readFileSync(targetPath, 'utf8');
let modified = false;

// ─── Patch 1: Remove bad body overwrite if present ───────────────────────────
const badBodyLine = 'message.body = options.caption;';
if (content.includes(badBodyLine)) {
  content = content.replace(badBodyLine, '// body is media preview data, do not overwrite with caption');
  modified = true;
  console.log('[Patch 1] Removed message.body = options.caption');
}

// ─── Patch 2: mediaOptions.set('caption', ...) ───────────────────────────────
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

// ─── Patch 3: Pre-compute _mediaJson to strip bad caption before spreading ───
const badSpread = '...(mediaOptions.toJSON ? mediaOptions.toJSON() : {}),';
const goodSpread =
  "..._mediaJson,";
const mediaJsonPrep =
  "        // Build mediaOptions JSON, but strip caption so it doesn't overwrite user's text\n" +
  "        const _mediaJson = mediaOptions.toJSON ? mediaOptions.toJSON() : {};\n" +
  "        if ('caption' in _mediaJson && (!_mediaJson.caption || typeof _mediaJson.caption !== 'string' || _mediaJson.caption.startsWith('data:'))) {\n" +
  "            delete _mediaJson.caption;\n" +
  "        }\n\n" +
  "        const message = {";

const msgStart = "        const message = {";

if (content.includes(badSpread) && !content.includes('const _mediaJson =')) {
  // Replace the bad spread line
  content = content.replace(badSpread, goodSpread);
  // Insert _mediaJson prep before 'const message = {'
  content = content.replace(msgStart, mediaJsonPrep);
  modified = true;
  console.log('[Patch 3] Replaced mediaOptions.toJSON spread with pre-computed _mediaJson');
}

// ─── Patch 4: Always re-apply user caption after message construction ─────────
const captionGuardOld = `        if (options && options.caption) {
            message.caption = options.caption;`;

const captionGuardNew =
  "        // Always re-apply user caption — this is the definitive fix so no spread can overwrite it\n" +
  "        if (options && options.caption && typeof options.caption === 'string' && !options.caption.startsWith('data:')) {\n" +
  "            message.caption = options.caption;";

const captionGuardFallback = `if (options && options.caption) {
            message.caption = options.caption;`;

if (!content.includes("Always re-apply user caption")) {
  if (content.includes(captionGuardOld)) {
    content = content.replace(captionGuardOld, captionGuardNew);
    modified = true;
    console.log('[Patch 4] Strengthened caption guard after message construction');
  } else if (content.includes('message.caption = options.caption;') && content.includes('message.isCaptionByUser = true;')) {
    console.log('[Patch 4] Caption guard already present, skipping');
  } else {
    // Fallback: insert after botOptions block
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

if (modified) {
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('[Patch] Utils.js patched successfully!');
} else if (content.includes('Always re-apply user caption') && content.includes('const _mediaJson =')) {
  console.log('[Patch] Utils.js is already fully patched!');
} else {
  console.log('[Patch] Warning: Could not find all insertion points in Utils.js. Manual inspection needed.');
}

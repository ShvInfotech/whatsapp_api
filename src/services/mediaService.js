const { MessageMedia } = require('whatsapp-web.js');

function detectMimeType(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return null;
  const sample = base64Str.slice(0, 30);
  if (sample.startsWith('/9j/')) return 'image/jpeg';
  if (sample.startsWith('iVBORw')) return 'image/png';
  if (sample.startsWith('R0lGOD')) return 'image/gif';
  if (sample.startsWith('UklGR')) return 'image/webp';
  if (sample.startsWith('JVBERi')) return 'application/pdf';
  return null;
}

function getExtension(mime) {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'application/pdf': return 'pdf';
    default: return 'jpg';
  }
}

/**
 * Builds a MessageMedia instance from various formats:
 * - base64 data URL: 'data:image/jpeg;base64,...'
 * - raw base64 string
 * - HTTP/HTTPS URL
 * - Buffer
 * - object with { data, base64, media, url, mediaUrl, mimetype, filename }
 */
async function buildMessageMedia(input) {
  if (!input) return null;
  if (input instanceof MessageMedia) return input;

  try {
    // 1. Buffer input
    if (Buffer.isBuffer(input)) {
      const b64 = input.toString('base64');
      const mime = detectMimeType(b64) || 'image/jpeg';
      const ext = getExtension(mime);
      return new MessageMedia(mime, b64, `attachment.${ext}`);
    }

    // 2. String input
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return null;

      // Data URL (e.g. data:image/png;base64,iVBOR...)
      if (trimmed.startsWith('data:')) {
        const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          const mime = match[1] || 'image/jpeg';
          const base64Data = match[2].trim().replace(/\s+/g, '');
          const ext = getExtension(mime);
          return new MessageMedia(mime, base64Data, `attachment.${ext}`);
        }
      }

      // HTTP / HTTPS URL
      if (/^https?:\/\//i.test(trimmed)) {
        return await MessageMedia.fromUrl(trimmed, { unsafeMime: true });
      }

      // Raw base64 string
      const cleanBase64 = trimmed.replace(/\s+/g, '');
      const mime = detectMimeType(cleanBase64) || 'image/jpeg';
      const ext = getExtension(mime);
      return new MessageMedia(mime, cleanBase64, `image.${ext}`);
    }

    // 3. Object input
    if (typeof input === 'object') {
      const url = input.mediaUrl || input.url || input.imageUrl;
      if (url && typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
        return await MessageMedia.fromUrl(url.trim(), { unsafeMime: true });
      }

      let data = input.data || input.base64 || input.media || input.image || input.file;
      let mime = input.mimetype || input.mime;
      let filename = input.filename || input.name;

      if (Buffer.isBuffer(data)) {
        data = data.toString('base64');
      }

      if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed.startsWith('data:')) {
          const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            mime = mime || match[1] || 'image/jpeg';
            data = match[2].trim().replace(/\s+/g, '');
          }
        } else if (/^https?:\/\//i.test(trimmed)) {
          return await MessageMedia.fromUrl(trimmed, { unsafeMime: true });
        } else {
          data = trimmed.replace(/\s+/g, '');
        }
      }

      if (data && typeof data === 'string') {
        mime = mime || detectMimeType(data) || 'image/jpeg';
        const ext = getExtension(mime);
        filename = filename || `attachment.${ext}`;
        return new MessageMedia(mime, data, filename);
      }
    }
  } catch (err) {
    console.error('[MediaService] Failed to build MessageMedia:', err.message);
    throw new Error(`Invalid media attachment: ${err.message}`);
  }

  return null;
}

module.exports = {
  buildMessageMedia,
  MessageMedia
};

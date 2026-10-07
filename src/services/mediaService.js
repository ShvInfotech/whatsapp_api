const { MessageMedia } = require('whatsapp-web.js');

/**
 * Builds a MessageMedia instance from various formats:
 * - base64 data URL: 'data:image/jpeg;base64,...'
 * - raw base64 string
 * - HTTP/HTTPS URL
 * - object with { data, base64, media, url, mediaUrl, mimetype, filename }
 */
async function buildMessageMedia(input) {
  if (!input) return null;
  if (input instanceof MessageMedia) return input;

  try {
    // 1. String input
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return null;

      // Data URL (e.g. data:image/png;base64,iVBOR...)
      if (trimmed.startsWith('data:')) {
        const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          const mime = match[1] || 'image/jpeg';
          const base64Data = match[2];
          const ext = mime.split('/')[1] || 'jpg';
          return new MessageMedia(mime, base64Data, `attachment.${ext}`);
        }
      }

      // HTTP / HTTPS URL
      if (/^https?:\/\//i.test(trimmed)) {
        return await MessageMedia.fromUrl(trimmed, { unsafeMime: true });
      }

      // Raw base64 string
      return new MessageMedia('image/jpeg', trimmed, 'image.jpg');
    }

    // 2. Object input
    if (typeof input === 'object') {
      const url = input.mediaUrl || input.url || input.imageUrl;
      if (url && typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
        return await MessageMedia.fromUrl(url.trim(), { unsafeMime: true });
      }

      let data = input.data || input.base64 || input.media || input.image;
      let mime = input.mimetype || input.mime || 'image/jpeg';
      let filename = input.filename || input.name || 'attachment.jpg';

      if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed.startsWith('data:')) {
          const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            mime = match[1] || mime;
            data = match[2];
          }
        } else if (/^https?:\/\//i.test(trimmed)) {
          return await MessageMedia.fromUrl(trimmed, { unsafeMime: true });
        }
      }

      if (data && typeof data === 'string') {
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

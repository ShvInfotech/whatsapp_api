const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.resolve(__dirname, '../../public/uploads');

function detectMimeAndExt(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return { mime: 'image/jpeg', ext: 'jpg' };
  const sample = base64Str.slice(0, 30);
  if (sample.startsWith('/9j/')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (sample.startsWith('iVBORw')) return { mime: 'image/png', ext: 'png' };
  if (sample.startsWith('R0lGOD')) return { mime: 'image/gif', ext: 'gif' };
  if (sample.startsWith('UklGR')) return { mime: 'image/webp', ext: 'webp' };
  if (sample.startsWith('JVBERi')) return { mime: 'application/pdf', ext: 'pdf' };
  return { mime: 'image/jpeg', ext: 'jpg' };
}

class UploadController {
  constructor() {
    this.ensureDir();
  }

  ensureDir() {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[UploadController] Error ensuring uploads directory:', err);
    }
  }

  /**
   * Upload an image/document via Base64 payload and get back a public URL
   * POST /api/upload
   * Body: { image: "data:image/jpeg;base64,...", filename: "invoice.jpg" }
   */
  async handleUpload(req, res) {
    try {
      this.ensureDir();
      const rawInput = req.body.image || req.body.file || req.body.media || req.body.data;
      if (!rawInput || typeof rawInput !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Please provide base64 image data in "image" or "file" field.'
        });
      }

      let base64Data = rawInput.trim();
      let explicitMime = null;

      if (base64Data.startsWith('data:')) {
        const commaIdx = base64Data.indexOf(',');
        if (commaIdx !== -1) {
          const header = base64Data.slice(0, commaIdx);
          base64Data = base64Data.slice(commaIdx + 1).trim();
          const match = header.match(/^data:([^;,]+)/i);
          if (match) explicitMime = match[1];
        }
      }

      base64Data = base64Data.replace(/\s+/g, '');
      const detected = detectMimeAndExt(base64Data);
      const mime = explicitMime || detected.mime;
      const ext = req.body.filename ? path.extname(req.body.filename).replace('.', '') || detected.ext : detected.ext;

      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid base64 image data.' });
      }

      const randomSuffix = crypto.randomBytes(6).toString('hex');
      const filename = `upload_${Date.now()}_${randomSuffix}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);

      fs.writeFileSync(filePath, buffer);

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const publicUrl = `${protocol}://${host}/uploads/${filename}`;

      return res.status(201).json({
        success: true,
        message: 'Image uploaded successfully.',
        url: publicUrl,
        filename: filename,
        mimetype: mime,
        size: buffer.length
      });
    } catch (err) {
      console.error('[UploadController] Upload error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to upload image.' });
    }
  }
}

module.exports = new UploadController();

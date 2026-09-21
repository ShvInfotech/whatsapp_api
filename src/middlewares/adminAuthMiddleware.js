const { verifySession } = require('../services/adminAuthService');

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index === -1 ? [] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }).filter((entry) => entry.length));
}

function requireAdmin(req, res, next) {
  const admin = verifySession(parseCookies(req).safevault_admin_session);
  if (!admin) return res.status(401).json({ success: false, error: 'Admin login is required.' });
  req.admin = admin;
  next();
}

module.exports = requireAdmin;

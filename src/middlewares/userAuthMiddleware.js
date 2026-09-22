const { verifySession } = require('../services/userAuthService');

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index === -1 ? [] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }).filter((entry) => entry.length));
}

async function requireUser(req, res, next) {
  try {
    const user = await verifySession(parseCookies(req).safevault_user_session);
    if (!user) return res.status(401).json({ success: false, error: 'User login is required.' });
    req.user = user;
    next();
  } catch (_) {
    return res.status(503).json({ success: false, error: 'User database is unavailable. Check MongoDB connection.' });
  }
}

module.exports = requireUser;

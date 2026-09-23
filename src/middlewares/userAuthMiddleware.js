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
    if (user.status === 'pending') return res.status(403).json({ success: false, error: 'Waiting For Admin Approval. Your account is not active yet.' });
    if (user.status === 'inactive') return res.status(403).json({ success: false, error: 'Your account has been deactivated by an administrator.' });
    req.user = user;
    next();
  } catch (_) {
    return res.status(503).json({ success: false, error: 'User database is unavailable. Check MongoDB connection.' });
  }
}

module.exports = requireUser;

const config = require('../config');

/**
 * Middleware to optionally secure API endpoints with an API key.
 * If API_KEY is set in .env, requests must provide it in the 'x-api-key' header
 * or 'apiKey' query parameter.
 */
function authMiddleware(req, res, next) {
  if (!config.apiKey) {
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!providedKey || providedKey !== config.apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or invalid API key'
    });
  }

  next();
}

module.exports = authMiddleware;

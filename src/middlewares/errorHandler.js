/**
 * 404 Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
}

/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  console.error('[Error] Unhandled Exception:', err);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};

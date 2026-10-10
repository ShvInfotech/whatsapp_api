/**
 * Safe Vault WhatsApp Automation Microservice
 * Entry Point
 */

require('./patch-caption');
const { startServer } = require('./src/server');

startServer().catch((err) => {
  console.error('[Fatal Error] Failed to start application:', err);
  process.exit(1);
});

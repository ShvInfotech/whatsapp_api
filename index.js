/**
 * Safe Vault WhatsApp Automation Microservice
 * Entry Point
 */

const { startServer } = require('./src/server');

startServer().catch((err) => {
  console.error('[Fatal Error] Failed to start application:', err);
  process.exit(1);
});

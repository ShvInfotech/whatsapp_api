const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const secret = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function getAdmin() {
  return JSON.parse(fs.readFileSync(config.adminDataPath, 'utf8'));
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key.toString('hex')));
  });
}

function hashesMatch(value, expectedHash) {
  return value.length === expectedHash.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expectedHash));
}

function sign(value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createSession(admin) {
  const payload = Buffer.from(JSON.stringify({ username: admin.username, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const admin = getAdmin();
    return session.exp > Date.now() && session.username === admin.username ? admin : null;
  } catch (_) {
    return null;
  }
}

async function authenticate(username, password) {
  const admin = getAdmin();
  if (!username || !password || username !== admin.username) return null;
  const suppliedHash = await hashPassword(password, admin.passwordSalt);
  const valid = hashesMatch(suppliedHash, admin.passwordHash);
  return valid ? admin : null;
}

async function resetPassword({ username, email, recoveryCode, newPassword }) {
  const admin = getAdmin();
  if (!username || !email || !recoveryCode || !newPassword || newPassword.length < 8) return false;
  if (username !== admin.username || email.toLowerCase() !== admin.email.toLowerCase()) return false;
  const recoveryHash = await hashPassword(recoveryCode, admin.recoveryCodeSalt);
  if (!hashesMatch(recoveryHash, admin.recoveryCodeHash)) return false;

  const passwordSalt = crypto.randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(newPassword, passwordSalt);
  const updatedAdmin = { ...admin, passwordSalt, passwordHash };
  const tempPath = `${config.adminDataPath}.tmp`;
  await fs.promises.writeFile(tempPath, `${JSON.stringify(updatedAdmin, null, 2)}\n`, 'utf8');
  await fs.promises.rename(tempPath, config.adminDataPath);
  return true;
}

function publicAdmin(admin) {
  return { username: admin.username, displayName: admin.displayName, email: admin.email };
}

module.exports = { authenticate, createSession, verifySession, publicAdmin, resetPassword };

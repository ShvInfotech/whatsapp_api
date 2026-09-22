const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('./databaseService');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const secret = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

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

function publicUser(user) {
  return {
    id: user._id.toString(), username: user.username, fullName: user.fullName,
    email: user.email, role: user.role || 'user', createdAt: user.createdAt
  };
}

async function register({ fullName, username, email, password }) {
  const cleanName = (fullName || '').trim();
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanName || !cleanUsername || !cleanEmail || !password) throw new Error('All registration fields are required.');
  if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) throw new Error('Username must be 3-30 characters and use letters, numbers, dot, dash, or underscore.');
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('Enter a valid email address.');
  if (password.length < 8) throw new Error('Password must contain at least 8 characters.');

  const passwordSalt = crypto.randomBytes(16).toString('hex');
  const user = {
    fullName: cleanName, username: cleanUsername, email: cleanEmail,
    passwordSalt, passwordHash: await hashPassword(password, passwordSalt),
    role: 'user', createdAt: new Date().toISOString()
  };
  try {
    const result = await (await getDatabase()).collection('users').insertOne(user);
    user._id = result.insertedId;
    return user;
  } catch (error) {
    if (error && error.code === 11000) throw new Error('This username or email is already registered.');
    throw error;
  }
}

async function authenticate(username, password) {
  if (!username || !password) return null;
  const user = await (await getDatabase()).collection('users').findOne({ username: username.trim().toLowerCase() });
  if (!user) return null;
  const suppliedHash = await hashPassword(password, user.passwordSalt);
  return hashesMatch(suppliedHash, user.passwordHash) ? user : null;
}

function createSession(user) {
  const payload = Buffer.from(JSON.stringify({ userId: user._id.toString(), exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

async function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.exp <= Date.now() || !ObjectId.isValid(session.userId)) return null;
    return await (await getDatabase()).collection('users').findOne({ _id: new ObjectId(session.userId) });
  } catch (_) { return null; }
}

async function listUsers() {
  return (await (await getDatabase()).collection('users').find({}, { projection: { passwordHash: 0, passwordSalt: 0 } }).sort({ createdAt: -1 }).toArray())
    .map(publicUser);
}

module.exports = { register, authenticate, createSession, verifySession, publicUser, listUsers };

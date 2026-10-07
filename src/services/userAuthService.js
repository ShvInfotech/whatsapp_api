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
  const quota = typeof user.messageQuota === 'number' ? user.messageQuota : 2500;
  const used = typeof user.messagesUsed === 'number' ? user.messagesUsed : 0;
  const plan = user.plan || 'Pro SaaS Plan';
  const planStatus = user.planStatus || 'active';
  const planExpiresAt = user.planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: user._id.toString(),
    username: user.username,
    fullName: user.fullName || user.username || 'User',
    email: user.email,
    role: user.role || 'user',
    status: user.status || 'active',
    plan,
    planStatus,
    messageQuota: quota,
    messagesUsed: used,
    creditsRemaining: Math.max(0, quota - used),
    planExpiresAt,
    createdAt: user.createdAt
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
  const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const user = {
    fullName: cleanName,
    username: cleanUsername,
    email: cleanEmail,
    passwordSalt,
    passwordHash: await hashPassword(password, passwordSalt),
    role: 'user',
    status: 'active',
    plan: 'Pro SaaS Plan',
    planStatus: 'active',
    messageQuota: 2500,
    messagesUsed: 0,
    planExpiresAt,
    createdAt: new Date().toISOString()
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

async function updateUserStatus(userId, status) {
  if (!ObjectId.isValid(userId) || !['active', 'inactive'].includes(status)) return null;
  const database = await getDatabase();
  const result = await database.collection('users').findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { status, statusUpdatedAt: new Date().toISOString() } },
    { returnDocument: 'after', projection: { passwordHash: 0, passwordSalt: 0 } }
  );
  return result ? publicUser(result) : null;
}

async function incrementMessagesUsed(userId, count = 1) {
  try {
    if (!ObjectId.isValid(userId)) return;
    const database = await getDatabase();
    await database.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { messagesUsed: count } }
    );
  } catch (err) {
    console.error('[UserAuthService] Error incrementing message count:', err);
  }
}

async function checkQuotaAvailable(userId, count = 1) {
  try {
    if (!ObjectId.isValid(userId)) return { allowed: true };
    const database = await getDatabase();
    const user = await database.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return { allowed: true };

    const quota = typeof user.messageQuota === 'number' ? user.messageQuota : 2500;
    const used = typeof user.messagesUsed === 'number' ? user.messagesUsed : 0;

    // Check expiry
    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
      return { allowed: false, error: 'Your subscription plan has expired. Please renew your plan.' };
    }

    if (used + count > quota) {
      return { allowed: false, error: `Monthly message quota limit reached (${used}/${quota}). Please upgrade or recharge.` };
    }

    return { allowed: true, remaining: quota - used };
  } catch (_) {
    return { allowed: true };
  }
}

const AVAILABLE_PLANS = {
  starter: { name: 'Starter Booster Plan', quota: 5000, days: 30, price: 499 },
  pro: { name: 'Pro Business Plan', quota: 25000, days: 30, price: 1499 },
  agency: { name: 'Agency Unlimited Plan', quota: 100000, days: 30, price: 3999 },
  topup_2k: { name: '+2,500 Credits Top-Up', addQuota: 2500, days: 30, price: 199 },
  topup_10k: { name: '+10,000 Credits Top-Up', addQuota: 10000, days: 30, price: 599 },
  topup_50k: { name: '+50,000 Credits Top-Up', addQuota: 50000, days: 30, price: 1799 }
};

async function updateUserProfile(userId, { fullName, username, email }) {
  if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID.');
  const cleanName = (fullName || '').trim();
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanName || !cleanUsername || !cleanEmail) {
    throw new Error('Full Name, Username, and Email are all required.');
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
    throw new Error('Username must be 3-30 characters and use letters, numbers, dot, dash, or underscore.');
  }
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  const database = await getDatabase();
  const existing = await database.collection('users').findOne({
    _id: { $ne: new ObjectId(userId) },
    $or: [{ username: cleanUsername }, { email: cleanEmail }]
  });
  if (existing) {
    throw new Error('The username or email is already in use by another account.');
  }

  const result = await database.collection('users').findOneAndUpdate(
    { _id: new ObjectId(userId) },
    {
      $set: {
        fullName: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        updatedAt: new Date().toISOString()
      }
    },
    { returnDocument: 'after' }
  );

  return result ? publicUser(result) : null;
}

async function changeUserPassword(userId, currentPassword, newPassword) {
  if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID.');
  if (!currentPassword || !newPassword) {
    throw new Error('Current password and new password are required.');
  }
  if (newPassword.length < 8) {
    throw new Error('New password must contain at least 8 characters.');
  }

  const database = await getDatabase();
  const user = await database.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User account not found.');

  const match = await authenticate(user.username, currentPassword);
  if (!match) {
    throw new Error('Current password is incorrect.');
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = await hashPassword(newPassword, newSalt);

  await database.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        passwordSalt: newSalt,
        passwordHash: newHash,
        passwordUpdatedAt: new Date().toISOString()
      }
    }
  );

  return true;
}

async function upgradeUserPlan(userId, planKey) {
  if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID.');
  const planInfo = AVAILABLE_PLANS[planKey];
  if (!planInfo) throw new Error('Invalid plan selection.');

  const database = await getDatabase();
  const user = await database.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User account not found.');

  const currentQuota = typeof user.messageQuota === 'number' ? user.messageQuota : 2500;
  let finalQuota = currentQuota;
  let planName = user.plan || 'Pro SaaS Plan';

  if (planInfo.quota) {
    finalQuota = planInfo.quota;
    planName = planInfo.name;
  } else if (planInfo.addQuota) {
    finalQuota = currentQuota + planInfo.addQuota;
  }

  const planExpiresAt = new Date(Date.now() + (planInfo.days || 30) * 24 * 60 * 60 * 1000).toISOString();

  const result = await database.collection('users').findOneAndUpdate(
    { _id: new ObjectId(userId) },
    {
      $set: {
        plan: planName,
        messageQuota: finalQuota,
        planExpiresAt,
        planStatus: 'active',
        status: 'active'
      }
    },
    { returnDocument: 'after' }
  );

  return result ? publicUser(result) : null;
}

module.exports = {
  register,
  authenticate,
  createSession,
  verifySession,
  publicUser,
  listUsers,
  updateUserStatus,
  incrementMessagesUsed,
  checkQuotaAvailable,
  upgradeUserPlan,
  updateUserProfile,
  changeUserPassword,
  AVAILABLE_PLANS
};

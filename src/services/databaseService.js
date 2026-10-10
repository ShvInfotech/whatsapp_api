const { MongoClient } = require('mongodb');
const config = require('../config');

let client;
let database;
let connectPromise;

async function getDatabase() {
  if (database) return database;
  if (!connectPromise) {
    client = new MongoClient(config.mongoUri);
    connectPromise = client.connect()
      .then(async () => {
        database = client.db(config.mongoDbName);
        await database.collection('users').createIndex({ username: 1 }, { unique: true });
        await database.collection('users').createIndex({ email: 1 }, { unique: true });
        await database.collection('templates').createIndex({ userId: 1, code: 1 }, { unique: true });
        await database.collection('templates').createIndex({ userId: 1, id: 1 });
        await database.collection('otp_verifications').createIndex({ phone: 1 });
        await database.collection('otp_verifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        return database;
      })
      .then(() => database)
      .catch((error) => {
        connectPromise = null;
        database = null;
        throw error;
      });
  }
  return connectPromise;
}

async function closeDatabase() {
  if (client) await client.close();
  client = null;
  database = null;
  connectPromise = null;
}

module.exports = { getDatabase, closeDatabase };

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
      .then(() => {
        database = client.db(config.mongoDbName);
        return database.collection('users').createIndex({ username: 1 }, { unique: true });
      })
      .then(() => database.collection('users').createIndex({ email: 1 }, { unique: true }))
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

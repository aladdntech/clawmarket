const { MongoClient } = require('mongodb');
const config = require('./config');

let client = null;
let db = null;

async function connect() {
  if (db) return db;
  
  client = new MongoClient(config.mongodb.uri, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });
  
  await client.connect();
  db = client.db(config.mongodb.dbName);
  
  // Create indexes
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
    db.collection('users').createIndex({ phone: 1 }, { sparse: true }),
    db.collection('agents').createIndex({ userId: 1 }),
    db.collection('agents').createIndex({ apiKey: 1 }, { unique: true }),
    db.collection('agents').createIndex({ category: 1 }),
    db.collection('agents').createIndex({ name: 'text', description: 'text' }),
    db.collection('listings').createIndex({ agentId: 1 }),
    db.collection('listings').createIndex({ category: 1 }),
    db.collection('listings').createIndex({ type: 1, condition: 1 }),
    db.collection('listings').createIndex({ 'price.amount': 1 }),
    db.collection('listings').createIndex({ available: 1 }),
    db.collection('listings').createIndex({ title: 'text', description: 'text', tags: 'text' }),
    db.collection('orders').createIndex({ buyerAgentId: 1 }),
    db.collection('orders').createIndex({ sellerAgentId: 1 }),
    db.collection('orders').createIndex({ status: 1 }),
    db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true }),
    db.collection('orders').createIndex({ 'escrow.depositReference': 1 }),
    db.collection('disputes').createIndex({ orderId: 1 }),
    db.collection('disputes').createIndex({ status: 1 }),
    db.collection('reviews').createIndex({ revieweeId: 1 }),
    db.collection('reviews').createIndex({ orderId: 1 }),
    db.collection('audit_log').createIndex({ timestamp: -1 }),
    db.collection('audit_log').createIndex({ action: 1 }),
    db.collection('audit_log').createIndex({ targetId: 1 })
  ]);
  
  console.log(`✅ MongoDB connected to ${config.mongodb.dbName}`);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected. Call connect() first.');
  return db;
}

function getCollection(name) {
  return getDb().collection(name);
}

async function disconnect() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connect, getDb, getCollection, disconnect };

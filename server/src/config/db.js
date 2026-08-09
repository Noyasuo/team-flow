const mongoose = require('mongoose');

function registerConnectionListeners() {
  if (mongoose.connection.__teamflowListenersRegistered) {
    return;
  }

  mongoose.connection.__teamflowListenersRegistered = true;

  mongoose.connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  });

  mongoose.connection.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', error);
  });

  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('MongoDB disconnected');
  });
}

async function connectDatabase(mongoUri) {
  mongoose.set('strictQuery', true);
  registerConnectionListeners();

  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return mongoose.connection;
  }

  await mongoose.connect(mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

async function closeDatabase() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
}

module.exports = { connectDatabase, closeDatabase };

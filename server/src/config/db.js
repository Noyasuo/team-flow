const mongoose = require('mongoose');

async function connectDatabase(mongoUri) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

module.exports = { connectDatabase };

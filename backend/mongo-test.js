const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || 'mongodb://admin:admin@127.0.0.1:27017/audiojobs?authSource=admin';

mongoose.connect(uri, { dbName: 'audiojobs' })
  .then(() => {
    console.log('MongoDB connection successful!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
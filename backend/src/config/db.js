import mongoose from 'mongoose';
import env from './env.js';

/**
 * Connect to MongoDB with retry logic.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;

import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

/**
 * Connect to MongoDB with transaction capability check.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);

    // Startup check for MongoDB transaction support
    try {
      const adminDb = conn.connection.db.admin();
      const helloResult = await adminDb.command({ hello: 1 }).catch(() => adminDb.command({ isMaster: 1 }));
      if (!helloResult.setName && !helloResult.msg?.includes('isdbgrid')) {
        console.error(
          '\n🚨 =========================================================================\n' +
          'CRITICAL WARNING: MongoDB is running in STANDALONE mode without replica set!\n' +
          'Mongoose multi-document sessions (session.withTransaction) will FAIL on standalone.\n' +
          'Phase 5 atomic money movements require a Replica Set (e.g. MongoDB Atlas).\n' +
          '=========================================================================\n'
        );
      } else {
        logger.info(`✅ MongoDB replica set / transaction support verified (${helloResult.setName || 'mongos'}).`);
      }
    } catch (checkErr) {
      logger.warn(`Could not verify MongoDB replica set status: ${checkErr.message}`);
    }
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;

import http from 'http';
import mongoose from 'mongoose';
import app from './app.js';
import env from './config/env.js';
import connectDB from './config/db.js';
import { initSocket } from './sockets/index.js';
import { ensureGeoIndexes } from './services/matching.service.js';
import { startAttendanceScheduler, stopAttendanceScheduler } from './services/attendance.scheduler.js';
import { startEscrowScheduler, stopEscrowScheduler } from './services/escrow.scheduler.js';
import { startSafetyScheduler, stopSafetyScheduler } from './services/safety.scheduler.js';
import logger from './utils/logger.js';

const httpServer = http.createServer(app);

// Initialize Socket.io
export const io = initSocket(httpServer, env.clientUrl);

// Connect to MongoDB & start server
const startServer = async () => {
  await connectDB();
  await ensureGeoIndexes();
  startAttendanceScheduler();
  startEscrowScheduler();
  startSafetyScheduler();

  httpServer.listen(env.port, () => {
    logger.info(`🚀 WorkPulse Backend listening on port ${env.port} (${env.nodeEnv})`);
  });
};

/**
 * Graceful shutdown procedure:
 * 1. Stop accepting new HTTP requests.
 * 2. Close active socket connections.
 * 3. Stop background schedulers after their current tick.
 * 4. Close MongoDB database connections.
 * 5. Hard 10s fallback timeout to force exit if tasks hang.
 */
export const shutdown = async (signal = 'SIGTERM') => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Hard timeout: 10 seconds
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s. Force killing process.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    // 1. Stop schedulers
    stopAttendanceScheduler();
    stopEscrowScheduler();
    stopSafetyScheduler();
    logger.info('Background schedulers stopped.');

    // 2. Close active sockets
    if (io) {
      io.close();
      logger.info('Socket.io connections closed.');
    }

    // 3. Close HTTP server
    await new Promise((resolve) => {
      httpServer.close(() => {
        logger.info('HTTP server closed.');
        resolve();
      });
    });

    // 4. Close MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
    }

    clearTimeout(forceExitTimeout);
    logger.info('Graceful shutdown complete.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  } catch (err) {
    logger.error('Error during graceful shutdown:', err);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  if (env.nodeEnv === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`);
  if (env.nodeEnv === 'production') {
    process.exit(1);
  }
});

// Start server only when run directly (not during testing)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { httpServer, app };

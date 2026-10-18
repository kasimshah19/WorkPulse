import http from 'http';
import app from './app.js';
import env from './config/env.js';
import connectDB from './config/db.js';
import { initSocket } from './sockets/index.js';
import { ensureGeoIndexes } from './services/matching.service.js';
import { startAttendanceScheduler, stopAttendanceScheduler } from './services/attendance.scheduler.js';
import logger from './utils/logger.js';

const httpServer = http.createServer(app);

// Initialize Socket.io
export const io = initSocket(httpServer, env.clientUrl);

// Connect to MongoDB & start server
const startServer = async () => {
  await connectDB();
  await ensureGeoIndexes();
  startAttendanceScheduler();

  httpServer.listen(env.port, () => {
    logger.info(`🚀 WorkPulse Backend listening on port ${env.port} (${env.nodeEnv})`);
  });
};

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  stopAttendanceScheduler();
  httpServer.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server only when run directly (not during testing)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { httpServer, app };

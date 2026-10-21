import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';

let ioInstance = null;

// In-memory registry for SMS fallback timers: key = `${jobId}_${workerId}`
export const activeFallbackTimers = new Map();

/**
 * Register an SMS fallback timer for an unacknowledged job socket broadcast.
 */
export const registerFallbackTimer = (jobId, workerId, timeoutId) => {
  const key = `${jobId}_${workerId}`;
  activeFallbackTimers.set(key, timeoutId);
};

/**
 * Cancel an SMS fallback timer when client sends `job:received` ack.
 */
export const cancelFallbackTimer = (jobId, workerId) => {
  const key = `${jobId}_${workerId}`;
  if (activeFallbackTimers.has(key)) {
    clearTimeout(activeFallbackTimers.get(key));
    activeFallbackTimers.delete(key);
    logger.info(`Cancelled SMS fallback timer for job:${jobId} worker:${workerId}`);
    return true;
  }
  return false;
};

/**
 * Get active Socket.io singleton instance.
 */
export const getIO = () => {
  return ioInstance;
};

/**
 * Initialize Socket.io server with JWT authentication and rooms.
 *
 * @param {import('http').Server} httpServer
 * @param {string} clientUrl
 * @returns {Server}
 */
export const initSocket = (httpServer, clientUrl) => {
  const io = new Server(httpServer, {
    cors: {
      origin: clientUrl || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  ioInstance = io;

  // JWT Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('AUTHENTICATION_ERROR: Token required'));
      }

      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(decoded.id).select('_id role phone name isActive');

      if (!user || !user.isActive) {
        return next(new Error('AUTHENTICATION_ERROR: Invalid or inactive user'));
      }

      socket.user = user;
      next();
    } catch (err) {
      logger.warn(`Socket auth rejected: ${err.message}`);
      next(new Error('AUTHENTICATION_ERROR: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`Socket connected: ${socket.id} (User: ${user._id}, Role: ${user.role})`);

    // Automatically join private user room and role-based room
    socket.join(`user:${user._id.toString()}`);
    socket.join(`role:${user.role}`);

    // Client Acknowledgement for Job Delivery (Cancels SMS fallback timer)
    socket.on('job:received', ({ jobId }) => {
      if (jobId) {
        cancelFallbackTimer(jobId, user._id.toString());
        logger.info(`Worker ${user._id} acknowledged job:new for ${jobId}`);
      }
    });

    // Client Delivery Receipt for SOS Alert
    socket.on('sos:ack-received', async ({ incidentId }) => {
      if (incidentId) {
        try {
          const Incident = (await import('../models/Incident.js')).default;
          await Incident.updateOne(
            {
              _id: incidentId,
              'alertedUsers.user': user._id,
              'alertedUsers.deliveredAt': null,
            },
            {
              $set: { 'alertedUsers.$.deliveredAt': new Date() },
            }
          );
          logger.info(`User ${user._id} confirmed delivery of sos:alert for ${incidentId}`);
        } catch (err) {
          logger.warn(`Failed to stamp sos:ack-received: ${err.message}`);
        }
      }
    });

    // Worker manual room joins if needed (e.g. active job room)
    socket.on('job:join', ({ jobId }) => {
      if (jobId) {
        socket.join(`job:${jobId}`);
        logger.info(`User ${user._id} joined job room: job:${jobId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${user._id})`);
    });
  });

  return io;
};

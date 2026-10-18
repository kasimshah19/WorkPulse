import { Server } from 'socket.io';
import logger from '../utils/logger.js';
import registerJobHandlers from './jobs.socket.js';
import registerAttendanceHandlers from './attendance.socket.js';

/**
 * Initialize Socket.io server with authentication and namespaces.
 *
 * TODO Phase 8: Wire up JWT auth middleware for socket connections and room management.
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

  // Socket authentication stub
  io.use((socket, next) => {
    // TODO Phase 1: Verify socket handshake auth token
    const token = socket.handshake.auth?.token;
    if (token) {
      socket.user = { id: 'stub-socket-user' };
    }
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Register domain handlers
    registerJobHandlers(io, socket);
    registerAttendanceHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

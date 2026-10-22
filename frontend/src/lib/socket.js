import { io } from 'socket.io-client';
import api from './api';

let socketInstance = null;
let isReconnectingAfterExpiry = false;

/**
 * Initialize or get active Socket.io client instance.
 *
 * @param {string} token - User JWT token
 * @returns {Socket}
 */
export const getSocket = (token) => {
  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ||
    'http://localhost:5000';

  if (!socketInstance && token) {
    socketInstance = io(socketUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    attachSocketLifecycleHandlers(socketInstance);
  } else if (socketInstance && token) {
    socketInstance.auth = { token };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }

  return socketInstance;
};

/**
 * Attach lifecycle and authentication error listeners
 */
function attachSocketLifecycleHandlers(socket) {
  socket.on('auth:expired', async ({ reason } = {}) => {
    if (isReconnectingAfterExpiry) return;
    isReconnectingAfterExpiry = true;

    try {
      const res = await api.post(
        '/auth/refresh',
        {},
        {
          headers: {
            'X-Requested-With': 'workpulse',
          },
        }
      );

      const payload = res.data?.data || res.data;
      const newToken = payload.accessToken || payload.token;

      if (newToken) {
        socket.auth = { token: newToken };
        socket.connect();
      } else {
        disconnectSocket();
      }
    } catch (_err) {
      disconnectSocket();
    } finally {
      isReconnectingAfterExpiry = false;
    }
  });

  socket.on('connect_error', async (err) => {
    if (err.message?.includes('AUTHENTICATION_ERROR') && !isReconnectingAfterExpiry) {
      isReconnectingAfterExpiry = true;
      try {
        const res = await api.post(
          '/auth/refresh',
          {},
          {
            headers: {
              'X-Requested-With': 'workpulse',
            },
          }
        );
        const payload = res.data?.data || res.data;
        const newToken = payload.accessToken || payload.token;
        if (newToken) {
          socket.auth = { token: newToken };
          socket.connect();
        }
      } catch (_e) {
        disconnectSocket();
      } finally {
        isReconnectingAfterExpiry = false;
      }
    }
  });
}

/**
 * Disconnect and clear active socket.
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

import { io } from 'socket.io-client';

let socketInstance = null;

/**
 * Initialize or get active Socket.io client instance.
 *
 * @param {string} token - User JWT token
 * @returns {Socket}
 */
export const getSocket = (token) => {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

  if (!socketInstance && token) {
    socketInstance = io(socketUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
  } else if (socketInstance && token) {
    socketInstance.auth = { token };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }

  return socketInstance;
};

/**
 * Disconnect and clear active socket.
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

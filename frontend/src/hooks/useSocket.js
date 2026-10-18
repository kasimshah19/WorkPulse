'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { getSocket, disconnectSocket } from '../lib/socket';

export const useSocket = () => {
  const { token, isAuthenticated } = useAuthStore();
  const { isConnected, setConnected, triggerJobAlert } = useSocketStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket();
      setConnected(false);
      return;
    }

    const socket = getSocket(token);

    const onConnect = () => {
      setConnected(true);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    // Broadcast event when a new matching job arrives
    const onJobNew = (jobData) => {
      // 1. Immediately send ACK to server to cancel the SMS fallback timer!
      if (jobData?.jobId) {
        socket.emit('job:received', { jobId: jobData.jobId });
      }

      // 2. Trigger prominent alert on screen
      triggerJobAlert(jobData);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('job:new', onJobNew);

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('job:new', onJobNew);
    };
  }, [token, isAuthenticated, setConnected, triggerJobAlert]);

  return { isConnected, socket: token ? getSocket(token) : null };
};

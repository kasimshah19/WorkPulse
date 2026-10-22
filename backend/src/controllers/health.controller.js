import mongoose from 'mongoose';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let lastAttendanceHeartbeat = Date.now();
let lastEscrowHeartbeat = Date.now();
let lastSafetyHeartbeat = Date.now();

export const updateSchedulerHeartbeat = (schedulerName) => {
  const now = Date.now();
  if (schedulerName === 'attendance') lastAttendanceHeartbeat = now;
  if (schedulerName === 'escrow') lastEscrowHeartbeat = now;
  if (schedulerName === 'safety') lastSafetyHeartbeat = now;
};

/**
 * Liveness check: lightweight ping
 */
export const getHealth = (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'workpulse-backend',
    version: '0.8.0',
    time: new Date().toISOString(),
  });
};

/**
 * Readiness check: verifies MongoDB ping, replica set / transaction capability,
 * voice service health (degraded if unavailable), and scheduler heartbeats.
 */
export const getReady = async (_req, res) => {
  const checks = {
    mongo: 'disconnected',
    transactions: false,
    voiceService: 'disabled',
    schedulers: {
      attendance: 'unknown',
      escrow: 'unknown',
      safety: 'unknown',
    },
  };

  let isReady = true;

  // 1. Check MongoDB
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      checks.mongo = 'connected';

      // Check replica set status for transaction support
      const isReplicaSet = Boolean(
        mongoose.connection.client?.topology?.description?.type?.includes('ReplicaSet') ||
        mongoose.connection.client?.topology?.description?.servers?.size > 0
      );
      checks.transactions = isReplicaSet;
    } else {
      checks.mongo = 'connecting';
      isReady = false;
    }
  } catch (err) {
    checks.mongo = 'error';
    checks.mongoError = err.message;
    isReady = false;
  }

  // 2. Check Voice Service with 1.5s timeout (degraded, does not fail readiness)
  if (env.voiceEnabled) {
    try {
      const response = await fetch(`${env.voiceServiceUrl}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        checks.voiceService = 'up';
      } else {
        checks.voiceService = 'degraded';
      }
    } catch {
      checks.voiceService = 'degraded';
    }
  }

  // 3. Scheduler Heartbeat Ages
  const now = Date.now();
  checks.schedulers = {
    attendance: `${Math.round((now - lastAttendanceHeartbeat) / 1000)}s ago`,
    escrow: `${Math.round((now - lastEscrowHeartbeat) / 1000)}s ago`,
    safety: `${Math.round((now - lastSafetyHeartbeat) / 1000)}s ago`,
  };

  const statusCode = isReady ? 200 : 503;
  return res.status(statusCode).json({
    status: isReady ? 'ready' : 'unready',
    service: 'workpulse-backend',
    timestamp: new Date().toISOString(),
    checks,
  });
};

export default {
  getHealth,
  getReady,
  updateSchedulerHeartbeat,
};

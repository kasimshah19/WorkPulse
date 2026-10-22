import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import env from '../config/env.js';
import User from '../models/User.js';
import { initSocket, getIO } from '../sockets/index.js';
import { issueAccessToken } from '../services/session.service.js';

// Import socket.io-client ESM bundle from frontend
const clientPath = path.resolve(fileURLToPath(import.meta.url), '../../../../frontend/node_modules/socket.io-client/build/esm/index.js');
const { io } = await import(`file://${clientPath}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runSocketLoad({ targetConnections = 300 } = {}) {
  console.log(`\n🔌 Starting WorkPulse WebSocket Load Benchmark (${targetConnections} concurrent connections)...`);

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.mongoUri);
  }

  // Find or create a test worker user for authentication
  let worker = await User.findOne({ role: 'worker', isActive: true });
  if (!worker) {
    worker = await User.create({
      phone: '+919999000300',
      name: 'Socket Benchmark Worker',
      role: 'worker',
      skills: ['mason'],
      isActive: true,
      kycStatus: 'simulated_verified',
    });
  }

  const token = issueAccessToken(worker, uuidv4(), uuidv4());

  // Start HTTP + Socket.io Server
  const server = http.createServer(app);
  const ioServer = initSocket(server, '*');
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const socketUrl = `http://127.0.0.1:${port}`;
  console.log(`  WebSocket Server listening on ${socketUrl}`);

  const memBefore = process.memoryUsage().rss / (1024 * 1024);
  const startTime = Date.now();
  const sockets = [];
  let connectedCount = 0;
  let errorCount = 0;

  console.log(`  Connecting ${targetConnections} concurrent WebSockets in batches...`);

  // Connect in parallel chunks to simulate rapid ramp-up
  const CHUNK_SIZE = 50;
  for (let c = 0; c < targetConnections; c += CHUNK_SIZE) {
    const batch = [];
    const countInBatch = Math.min(CHUNK_SIZE, targetConnections - c);

    for (let i = 0; i < countInBatch; i++) {
      batch.push(
        new Promise((resolve) => {
          const client = io(socketUrl, {
            auth: { token },
            transports: ['websocket'],
            reconnection: false,
            forceNew: true,
          });

          client.on('connect', () => {
            connectedCount++;
            resolve(client);
          });

          client.on('connect_error', (err) => {
            errorCount++;
            resolve(null);
          });
        })
      );
    }

    const connectedBatch = await Promise.all(batch);
    connectedBatch.forEach((s) => {
      if (s) sockets.push(s);
    });

    process.stdout.write(`\r  Progress: ${connectedCount}/${targetConnections} sockets connected...`);
  }

  const connectDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\r  ✅ Connected ${connectedCount}/${targetConnections} sockets in ${connectDuration}s (Errors: ${errorCount})`);

  // Broadcast Benchmark: Emit message to role:worker room and measure latency to receive across all clients
  console.log(`\n  Broadcasting test event to all ${connectedCount} connected clients...`);
  const broadcastStart = Date.now();
  let receivedCount = 0;

  const broadcastPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ receivedCount, timeout: true });
    }, 5000);

    sockets.forEach((s) => {
      s.once('broadcast:test', () => {
        receivedCount++;
        if (receivedCount === connectedCount) {
          clearTimeout(timeout);
          resolve({ receivedCount, timeout: false });
        }
      });
    });
  });

  // Emit event via server
  ioServer.to('role:worker').emit('broadcast:test', {
    message: 'High concurrency benchmark broadcast payload',
    timestamp: Date.now(),
  });

  const broadcastRes = await broadcastPromise;
  const broadcastDurationMs = Date.now() - broadcastStart;
  const memAfter = process.memoryUsage().rss / (1024 * 1024);

  console.log(`  ✅ Broadcast delivered to ${broadcastRes.receivedCount}/${connectedCount} sockets in ${broadcastDurationMs}ms`);
  console.log(`  Memory Usage: Before=${memBefore.toFixed(1)}MB | After=${memAfter.toFixed(1)}MB | Delta=+${(memAfter - memBefore).toFixed(1)}MB`);

  // Gracefully disconnect clients
  sockets.forEach((s) => s.disconnect());
  ioServer.close();
  server.close();
  await mongoose.disconnect();

  // Append results to docs/performance.md
  const reportSection = `\n## WebSocket Concurrency Benchmark (300 Connections)
- **Target Connections**: ${targetConnections}
- **Successfully Connected**: ${connectedCount} (${connectDuration}s ramp-up)
- **Connection Errors**: ${errorCount}
- **Broadcast Fan-Out**: Delivered to ${broadcastRes.receivedCount}/${connectedCount} clients in **${broadcastDurationMs}ms**
- **Memory Overhead**: ${(memAfter - memBefore).toFixed(1)}MB for ${connectedCount} active sockets (~${(((memAfter - memBefore) * 1024) / connectedCount).toFixed(1)} KB/socket)
`;

  const perfMdPath = path.resolve(__dirname, '../../../docs/performance.md');
  fs.appendFileSync(perfMdPath, reportSection, 'utf8');
  console.log(`\n📄 WebSocket metrics appended to docs/performance.md`);

  return {
    targetConnections,
    connectedCount,
    errorCount,
    broadcastDurationMs,
    memDeltaMB: Number((memAfter - memBefore).toFixed(1)),
  };
}

if (process.argv[1]?.endsWith('socket-load.js')) {
  runSocketLoad().catch((err) => {
    console.error('Socket load execution error:', err);
    process.exit(1);
  });
}

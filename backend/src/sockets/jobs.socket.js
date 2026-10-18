/**
 * Job real-time event handlers.
 * Handles job broadcasting, instant acceptance notifications.
 *
 * TODO Phase 2 / Phase 8: Broadcast job creation to nearby workers via geo-rooms.
 */
export default function registerJobHandlers(io, socket) {
  socket.on('job:subscribe_area', (_data) => {
    // TODO Phase 2: Join room corresponding to geo-grid or district
  });

  socket.on('job:apply', (_data) => {
    // TODO Phase 2: Notify contractor in real time
  });
}

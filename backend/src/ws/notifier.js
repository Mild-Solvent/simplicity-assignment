const { WebSocketServer } = require('ws');

let wss = null;

/**
 * Attaches the WebSocket server to an existing HTTP server.
 * @param {import('http').Server} httpServer
 */
function initWS(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (socket) => {
    console.log('🔌 WebSocket client connected');
    socket.on('close', () => console.log('🔌 WebSocket client disconnected'));
  });

  console.log('✅ WebSocket server initialised');
}

/**
 * Broadcasts a message to all connected WebSocket clients.
 * @param {{ type: string, data: any }} payload
 */
function broadcast(payload) {
  if (!wss) return;
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      client.send(message);
    }
  });
}

module.exports = { initWS, broadcast };

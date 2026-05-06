const http = require('http');
const express = require('express');
const cors = require('cors');
const announcementsRouter = require('./routes/announcements');
const { initWS } = require('./ws/notifier');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/announcements', announcementsRouter);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Announcements API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const server = http.createServer(app);
initWS(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket available on ws://localhost:${PORT}`);
});

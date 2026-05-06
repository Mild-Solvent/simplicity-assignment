# 🔌 WebSocket Protocol

The backend exposes a WebSocket server on the **same port** as the HTTP server (`ws://localhost:3001`). No authentication or handshake beyond the standard WS upgrade is required.

---

## Connection

```
ws://localhost:3001
```

The frontend connects via the `useWebSocket` hook (`src/hooks/useWebSocket.js`). A singleton pattern ensures only **one real socket** exists regardless of how many React components call the hook.

---

## Message Format

All messages are **JSON strings**. Parse with `JSON.parse(event.data)`.

```typescript
{
  type: string;  // event type identifier
  data: any;     // event payload
}
```

---

## Event Types

### `NEW_ANNOUNCEMENT`

Fired when a new announcement is published. This can happen in two ways:

1. **Immediate** — `publication_date` is in the past/present when `POST /api/announcements` is called → broadcast fires right away
2. **Scheduled** — `publication_date` is in the future → broadcast fires at that exact time, powered by `node-schedule`

**Payload:**
```json
{
  "type": "NEW_ANNOUNCEMENT",
  "data": {
    "id": 12,
    "title": "Spring Community Cleanup",
    "body": "Join us on Saturday for a community cleanup event in the park.",
    "publication_date": "2026-06-01T10:00:00.000Z",
    "last_update": "2026-05-06T18:30:00.000Z",
    "categories": ["City", "Community events"],
    "created_at": "2026-05-06T18:30:00.000Z"
  }
}
```

---

## Client Behaviour (Frontend)

The `useWebSocket` hook (`src/hooks/useWebSocket.js`) implements:

| Behaviour | Detail |
|---|---|
| **Singleton socket** | `sharedWs` is a module-level variable — all hook instances share one connection |
| **Listener set** | Each hook call registers a callback in a `Set<Function>`; mount/unmount only adds/removes the callback |
| **Auto-reconnect** | If the socket closes and there are active listeners, it reconnects after **3 seconds** |
| **StrictMode safe** | The double-mount cycle in React 18/19 dev mode does **not** create two sockets |

```javascript
// Usage in any component
import { useWebSocket } from '../hooks/useWebSocket';

useWebSocket((payload) => {
  if (payload.type === 'NEW_ANNOUNCEMENT') {
    console.log('New announcement:', payload.data.title);
  }
});
```

---

## Server Behaviour

`src/ws/notifier.js` wraps `ws.WebSocketServer`:

```javascript
// Broadcast to ALL connected clients
broadcast({ type: 'NEW_ANNOUNCEMENT', data: announcement });
```

Only clients with `readyState === WebSocket.OPEN` (value `1`) receive messages. Clients that are connecting or closing are silently skipped.

---

## Lifecycle Diagram

```
Server boot
  └─► initWS(httpServer)   — WS server attached to HTTP server

Client connects
  └─► 'connection' event logged

Announcement created (pubDate ≤ now)
  └─► broadcast()
        └─► all OPEN clients receive { type, data }

Announcement created (pubDate > now)
  └─► node-schedule job created
        └─► at pubDate: broadcast()

Client disconnects
  └─► 'close' event logged
  └─► removed from wss.clients automatically

Server restarts
  └─► initScheduler() re-queues pending jobs from DB
  └─► new clients connect fresh
```

---

## See Also

- [REST API Reference](./rest.md)
- [Scheduler Lifecycle](../backend/scheduler.md)
- [Architecture Overview](../architecture/overview.md)

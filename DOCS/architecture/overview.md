# 🏛️ Architecture Overview

This document describes the overall system design of the Announcements Dashboard — how the frontend, backend, database, and real-time notification layers interact.

---

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│                                                              │
│  ┌──────────────┐   REST/HTTP   ┌────────────────────────┐  │
│  │   React SPA  │◄────────────►│  Express REST API       │  │
│  │  (Vite dev   │               │  /api/announcements     │  │
│  │   :5173)     │   WebSocket   │  (Node.js :3001)        │  │
│  │              │◄─────────────│                          │  │
│  └──────────────┘               └──────────┬─────────────┘  │
│                                            │                 │
│                               ┌────────────▼─────────────┐  │
│                               │       SQLite DB           │  │
│                               │   (data/announcements.db) │  │
│                               │                           │  │
│                               │  • announcements table    │  │
│                               │  • notification_jobs table│  │
│                               │  • schema_migrations table│  │
│                               └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Request / Response Data Flow

### Reading announcements

```
Browser
  └─► GET /api/announcements?page=1&search=park&category=City
        └─► routes/announcements.js
              └─► better-sqlite3 query (SELECT … WHERE … LIMIT … OFFSET …)
                    └─► JSON response { data: [...], pagination: {...} }
                          └─► AnnouncementsTable renders rows
```

### Creating an announcement

```
Browser (EditAnnouncementPage.handlePublish)
  └─► POST /api/announcements  { title, body, publication_date, categories }
        └─► express-validator validates fields
              └─► INSERT INTO announcements
                    └─► scheduleOrBroadcast(created)
                          ├─► publication_date ≤ now?
                          │     └─► broadcast({ type:'NEW_ANNOUNCEMENT', data })
                          │           └─► ws.clients → each client gets a message
                          │                 └─► NotificationToast shows 🔔 toast
                          └─► publication_date > now?
                                └─► INSERT INTO notification_jobs
                                      └─► node-schedule job at pubDate
                                            └─► (at pubDate) broadcast(...)
```

### Server restart with pending jobs

```
Server starts → src/index.js
  └─► initScheduler()
        └─► SELECT * FROM notification_jobs WHERE fired_at IS NULL
              ├─► scheduled_for > now  →  createJob() re-queues in node-schedule
              └─► scheduled_for ≤ now  →  markFired() (skip re-broadcast, already sent)
```

---

## Module Dependency Graph

```
src/index.js
├── routes/announcements.js
│   ├── db/database.js
│   │   └── db/migrate.js
│   │       └── db/migrations/*.sql
│   └── scheduler/notificationScheduler.js
│       ├── db/database.js
│       └── ws/notifier.js
└── ws/notifier.js
```

---

## Port Map

| Service | Protocol | Port |
|---|---|---|
| React (Vite) | HTTP | 5173 |
| Express REST | HTTP | 3001 |
| WebSocket | WS | 3001 (shared with HTTP) |

The WebSocket server is **attached to the same HTTP server** as Express — both live on port 3001. The frontend connects to `ws://localhost:3001`.

---

## Design Decisions

### Why SQLite?
- Zero infrastructure — no separate database process
- `better-sqlite3` offers a synchronous API that pairs naturally with Express (no async complexity in route handlers)
- WAL mode allows concurrent reads without blocking

### Why WebSocket instead of polling?
- Instant delivery when an announcement is published or a scheduled job fires
- No unnecessary network traffic (no polling interval)

### Why a singleton WebSocket in the frontend?
- Prevents duplicate connections in React StrictMode (which mounts effects twice in development)
- Ensures exactly one message delivery per event regardless of how many components use `useWebSocket`

### Why `node-schedule` instead of a cron?
- Accepts a `Date` object directly — fires exactly at `publication_date`, not on a rounded interval
- Integrates cleanly with Node.js without external process dependencies

---

## See Also

- [REST API Reference](../api/rest.md)
- [WebSocket Protocol](../api/websocket.md)
- [Database Schema](../database/schema.md)
- [Scheduler Lifecycle](../backend/scheduler.md)

# ⚙️ Backend — Announcements API

Node.js / Express 5 REST API with an embedded SQLite database, a WebSocket notification server, and a durable scheduled-notification engine.

---

## ✨ Features

- **Full CRUD REST API** for announcements with input validation (`express-validator`)
- **WebSocket broadcast** — every connected client receives a `NEW_ANNOUNCEMENT` event when a post is published
- **Scheduled notifications** — publication dates in the future are persisted to `notification_jobs` and fired by `node-schedule` at the right moment
- **Restart-safe scheduler** — on server boot, all pending (not-yet-fired) jobs are re-queued from the database
- **Automatic migrations** — SQL migration files are applied in order on every startup; already-applied files are skipped
- **Auto-seeding** — 10 sample announcements are inserted when the database is empty
- **WAL journal mode** — SQLite runs in Write-Ahead Logging mode for better concurrent read performance

---

## 📁 Project Structure

```
backend/
├── package.json
└── src/
    ├── index.js                        # Entry point: Express + HTTP server + WS init + Scheduler boot
    ├── routes/
    │   └── announcements.js            # GET / POST / PUT / DELETE /api/announcements
    ├── db/
    │   ├── database.js                 # DB connection, WAL pragma, migrations, seeding
    │   ├── migrate.js                  # Migration runner (reads .sql files, tracks applied)
    │   └── migrations/
    │       ├── 001_create_announcements.sql
    │       └── 002_create_notification_jobs.sql
    ├── scheduler/
    │   └── notificationScheduler.js    # scheduleOrBroadcast / rescheduleJob / cancelJob / initScheduler
    └── ws/
        └── notifier.js                 # WebSocketServer wrapper: initWS() + broadcast()
```

---

## 🚀 Getting Started

```bash
npm install
npm run dev     # nodemon auto-restart on file changes — http://localhost:3001
npm start       # production start (no nodemon)
```

The database file is created automatically at `../data/announcements.db` (relative to `backend/`). The `data/` directory is git-ignored.

---

## 🔌 Endpoints

### `GET /api/announcements`

Returns a paginated, optionally filtered list of announcements.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | Page number |
| `limit` | integer 1–100 | `10` | Items per page |
| `search` | string | — | Case-insensitive full-text search on `title` and `body` |
| `category` | string | — | Comma-separated category values; matches any of the listed categories |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Title 1",
      "body": "Community update...",
      "publication_date": "2023-08-11T04:38:00.000Z",
      "last_update": "2023-08-11T04:38:00.000Z",
      "categories": ["City"],
      "created_at": "2023-08-11T04:38:00.000Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### `GET /api/announcements/:id`

Returns a single announcement by ID.

**Response:** `200 OK` with the announcement object, or `404` if not found.

---

### `POST /api/announcements`

Creates a new announcement. If `publication_date` is in the past or present, a WebSocket broadcast fires immediately. If it is in the future, a scheduled job is created.

**Request body:**
```json
{
  "title": "New Park Opening",
  "body": "The new park will open on Saturday.",
  "publication_date": "2026-06-01T10:00:00.000Z",
  "categories": ["City", "Community events"]
}
```

**Response:** `201 Created` with the created announcement object.

**Validation errors:** `400 Bad Request` with an `errors` array.

---

### `PUT /api/announcements/:id`

Updates an existing announcement. Any previously scheduled notification is cancelled and re-evaluated against the new `publication_date`.

**Request body:** Same shape as `POST`.

**Response:** `200 OK` with the updated announcement.

---

### `DELETE /api/announcements/:id`

Deletes an announcement. Any pending scheduled notification is cancelled first.

**Response:** `204 No Content`, or `404` if not found.

---

## 🔌 WebSocket

The WebSocket server shares the same port as the HTTP server (`ws://localhost:3001`).

**Event message format:**
```json
{
  "type": "NEW_ANNOUNCEMENT",
  "data": {
    "id": 7,
    "title": "...",
    "body": "...",
    "publication_date": "...",
    "last_update": "...",
    "categories": ["City"],
    "created_at": "..."
  }
}
```

Events are sent to **all connected clients** using `wss.clients.forEach`.

---

## ⏰ Notification Scheduler

The scheduler (`src/scheduler/notificationScheduler.js`) manages deferred WebSocket broadcasts:

| Function | Called when | Behaviour |
|---|---|---|
| `scheduleOrBroadcast(ann)` | After `POST` | Broadcasts immediately if `publication_date ≤ now`, otherwise persists a `notification_jobs` row and schedules a `node-schedule` job |
| `rescheduleJob(ann)` | After `PUT` | Cancels any existing in-memory job, re-evaluates the new date |
| `cancelJob(id)` | Before `DELETE` | Cancels in-memory job + removes DB row |
| `initScheduler()` | Server boot | Re-queues all pending (unfired) rows; skips missed jobs silently |

In-memory jobs are tracked in a `Map<announcementId, Job>`. The `notification_jobs` table provides durability across restarts.

---

## 🗄️ Database

**Driver:** `better-sqlite3` (synchronous API, no callback/promise overhead)  
**File:** `data/announcements.db` (WAL + foreign keys enabled)

### Tables

#### `announcements`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `title` | TEXT | Required |
| `body` | TEXT | Required |
| `publication_date` | TEXT | ISO 8601 string |
| `last_update` | TEXT | ISO 8601; updated on every `PUT` |
| `categories` | TEXT | JSON array, e.g. `["City","Health"]` |
| `created_at` | TEXT | ISO 8601; set once on `POST` |

#### `notification_jobs`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `announcement_id` | INTEGER | UNIQUE FK → `announcements.id` ON DELETE CASCADE |
| `scheduled_for` | TEXT | ISO 8601; when to fire the WS broadcast |
| `fired_at` | TEXT | NULL = pending; ISO string when fired |

### Adding a new migration

Create `backend/src/db/migrations/NNN_description.sql` and the next server start will apply it automatically.

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `express` ^5.2 | HTTP server + routing |
| `better-sqlite3` ^12.9 | Synchronous SQLite driver |
| `ws` ^8.20 | WebSocket server |
| `node-schedule` ^2.1 | Date-based job scheduling |
| `express-validator` ^7.3 | Input validation middleware |
| `cors` ^2.8 | Cross-origin request headers |
| `nodemon` ^3.1 | Dev: auto-restart on file changes |

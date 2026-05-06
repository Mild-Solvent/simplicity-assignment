# ⚙️ Backend Structure

Node.js + Express 5 API server. This document covers the module layout, middleware configuration, request lifecycle, and error handling.

---

## Entry Point (`src/index.js`)

The entry point wires everything together in a deliberate order:

```javascript
// 1. Create Express app
const app = express();

// 2. Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// 3. Routes
app.use('/api/announcements', announcementsRouter);

// 4. Health check
app.get('/', ...);

// 5. 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// 6. Wrap in HTTP server (required to share port with WS)
const server = http.createServer(app);
initWS(server);          // attach WebSocket server

// 7. Listen
server.listen(PORT, () => {
  initScheduler();       // re-queue pending notifications from DB
});
```

**Why `http.createServer(app)` instead of `app.listen()`?**  
The `ws` package's `WebSocketServer` needs a raw `http.Server` to attach the WebSocket upgrade handler. Wrapping Express explicitly provides that.

---

## Module Overview

| Module | File | Responsibility |
|---|---|---|
| Entry point | `src/index.js` | App assembly, server start |
| Route handler | `src/routes/announcements.js` | HTTP handlers for `/api/announcements` |
| DB connection | `src/db/database.js` | Open SQLite, run migrations, seed data |
| Migration runner | `src/db/migrate.js` | Apply `.sql` files in order |
| SQL migrations | `src/db/migrations/*.sql` | Schema DDL |
| Scheduler | `src/scheduler/notificationScheduler.js` | Schedule / cancel / re-queue WS notifications |
| WS notifier | `src/ws/notifier.js` | WebSocket server wrapper + broadcast helper |

---

## Middleware Stack

```
Request
  │
  ├─ CORS (origin: http://localhost:5173)
  │    Adds Access-Control-Allow-Origin header; rejects other origins in browsers
  │
  ├─ express.json()
  │    Parses application/json request bodies into req.body
  │
  ├─ Router: /api/announcements
  │    └─ express-validator middlewares (per-route)
  │         └─ Route handler (reads/writes DB, triggers scheduler)
  │
  ├─ Health check: GET /
  │
  └─ 404 handler
       Returns { error: 'Route not found' }
```

---

## Route Handler (`src/routes/announcements.js`)

### Helper functions

#### `handleValidationErrors(req, res)`
Runs `validationResult(req)`. If there are errors, immediately responds with `400` and returns a truthy value so the route handler can `return` early.

#### `parseAnnouncement(row)`
Transforms a raw SQLite row (where `categories` is a JSON string) into an object with a native `categories` array. Called on every row before it is sent to the client.

### Route summary

| Method | Path | Validator | Handler |
|---|---|---|---|
| GET | `/` | `page`, `limit` (optional ints) | Query DB with optional search/category WHERE clauses; return paginated data |
| GET | `/:id` | `id` (int ≥ 1) | Fetch single row or 404 |
| POST | `/` | `title`, `body`, `publication_date` (notEmpty), `categories` (array ≥ 1) | INSERT; call `scheduleOrBroadcast` |
| PUT | `/:id` | same as POST + `id` param | UPDATE; call `rescheduleJob` |
| DELETE | `/:id` | `id` (int ≥ 1) | Call `cancelJob`; DELETE row |

### Category filtering (GET `/`)

The `category` query param accepts a **comma-separated list**:
```
?category=City,Health
```
Each value is matched with a `LIKE` clause against the JSON `categories` column:
```sql
WHERE (LOWER(categories) LIKE '%city%' OR LOWER(categories) LIKE '%health%')
```
This is a simple substring match — sufficient for the current data model where category names don't overlap.

---

## Database Module (`src/db/database.js`)

1. Resolves the DB path to `data/announcements.db` (3 levels up from the file's location, at the repo root's `data/` directory)
2. Creates the `data/` directory if it doesn't exist
3. Opens the database with `better-sqlite3`
4. Enables:
   - `PRAGMA journal_mode = WAL` — concurrent reads without locking
   - `PRAGMA foreign_keys = ON` — enforces `ON DELETE CASCADE` on `notification_jobs`
5. Runs migrations via `runMigrations(db)`
6. Seeds 10 sample announcements if the `announcements` table is empty

---

## Migration Runner (`src/db/migrate.js`)

**Algorithm:**
1. Ensure a `schema_migrations` table exists (idempotent `CREATE TABLE IF NOT EXISTS`)
2. Load all applied migration filenames from `schema_migrations`
3. Read all `*.sql` files from `src/db/migrations/`, sorted lexicographically
4. For each file not already in `schema_migrations`:
   - Apply the SQL inside a transaction
   - Record the filename + `applied_at` timestamp
5. Log how many migrations were applied (or "up to date" if zero)

**To add a migration:** create `src/db/migrations/NNN_description.sql`. The next server start applies it automatically.

---

## WebSocket Notifier (`src/ws/notifier.js`)

```javascript
initWS(httpServer)
// Attaches WebSocketServer to the existing HTTP server.
// Logs connect/disconnect events.

broadcast({ type, data })
// Sends JSON to every client where readyState === 1 (OPEN).
```

`wss` is kept in module scope. `broadcast` is a no-op if `initWS` has not been called yet.

---

## Error Handling

| Scenario | Response |
|---|---|
| Validation failure | `400 { errors: [...] }` |
| Record not found | `404 { error: '...' }` |
| Unknown route | `404 { error: 'Route not found' }` |
| Unhandled exceptions | Let Express 5's default error handler respond (500) |

> Express 5 automatically propagates errors thrown in async route handlers — no `try/catch` wrapping is needed in the routes. The current routes use synchronous `better-sqlite3` so this is not yet exercised, but the upgrade path to async handlers is clear.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP (and WS) listen port |

---

## Development vs Production

| Mode | Command | Notes |
|---|---|---|
| Development | `npm run dev` | Runs `nodemon src/index.js` — restarts on file changes |
| Production | `npm start` | Runs `node src/index.js` directly |

---

## See Also

- [Scheduler Lifecycle](./scheduler.md)
- [Database Schema](../database/schema.md)
- [REST API Reference](../api/rest.md)
- [Architecture Overview](../architecture/overview.md)

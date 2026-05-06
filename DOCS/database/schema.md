# 🗄️ Database Schema

**Driver:** `better-sqlite3` (synchronous Node.js SQLite driver)  
**File:** `data/announcements.db` (at the repo root, git-ignored)  
**Journal mode:** WAL (Write-Ahead Logging)  
**Foreign keys:** ON

---

## Tables

### `announcements`

Primary data table. Each row represents one announcement.

```sql
CREATE TABLE IF NOT EXISTS announcements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  body             TEXT    NOT NULL,
  publication_date TEXT    NOT NULL,
  last_update      TEXT    NOT NULL,
  categories       TEXT    NOT NULL,  -- JSON array, e.g. '["City","Health"]'
  created_at       TEXT    NOT NULL
);
```

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | NO | Auto-increment primary key |
| `title` | TEXT | NO | Announcement title |
| `body` | TEXT | NO | Full announcement content |
| `publication_date` | TEXT | NO | ISO 8601 timestamp — when the announcement is considered published |
| `last_update` | TEXT | NO | ISO 8601 timestamp — updated on every `PUT`; equals `created_at` for new rows |
| `categories` | TEXT | NO | JSON-encoded array of category strings, e.g. `["City","Health"]` |
| `created_at` | TEXT | NO | ISO 8601 timestamp — set once on `INSERT`, never changed |

> **Why TEXT for timestamps?**  
> SQLite has no native timestamp type. Storing ISO 8601 strings preserves timezone information (UTC `Z` suffix) and sorts correctly as strings. `better-sqlite3` does not auto-convert dates — all conversion happens in JavaScript.

> **Why TEXT for categories?**  
> A JSON column keeps the schema simple — no join table is needed for the current feature set. The `parseAnnouncement` helper in the routes always converts the string back to a native array before returning data to the client.

---

### `notification_jobs`

Tracks scheduled WebSocket notifications. A row is inserted when a new announcement has a future `publication_date`. It is removed (or marked fired) once the notification is sent.

```sql
CREATE TABLE IF NOT EXISTS notification_jobs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id  INTEGER NOT NULL UNIQUE,
  scheduled_for    TEXT    NOT NULL,
  fired_at         TEXT,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);
```

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | NO | Auto-increment primary key |
| `announcement_id` | INTEGER | NO | FK → `announcements.id`; UNIQUE (one job per announcement) |
| `scheduled_for` | TEXT | NO | ISO 8601 timestamp — when to fire the WS broadcast |
| `fired_at` | TEXT | YES | NULL = pending; ISO timestamp when the broadcast was sent |

**Cascade delete:** deleting an announcement automatically removes its `notification_jobs` row — no manual cleanup needed in most cases (the scheduler also calls `deleteJobRow` proactively for in-flight cancellations).

---

### `schema_migrations`

Internal tracking table managed by the migration runner. Never written to by application code.

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

| Column | Type | Description |
|---|---|---|
| `version` | TEXT PK | Migration filename, e.g. `001_create_announcements.sql` |
| `applied_at` | TEXT | ISO timestamp when the migration was applied |

---

## Migrations

All migrations live in `backend/src/db/migrations/` and are applied by `src/db/migrate.js` on every server start. Already-applied files are skipped.

| File | Description |
|---|---|
| `001_create_announcements.sql` | Creates the `announcements` table |
| `002_create_notification_jobs.sql` | Creates the `notification_jobs` table |

### Adding a migration

1. Create `backend/src/db/migrations/NNN_description.sql` (where `NNN` is the next number in sequence)
2. Write the DDL inside the file
3. Start the server — the migration is applied automatically

> Migrations run inside a **transaction**: if the SQL fails, the migration is rolled back and the `schema_migrations` row is not inserted, so it will be retried on the next start.

---

## Seed Data

When the server starts and the `announcements` table is **empty**, 10 sample announcements are inserted automatically:

| Title | Categories | Publication date |
|---|---|---|
| Title 1–6 | City | 2023-08-11 / 2023-04-19 |
| Title 7–10 | City, Health | 2023-03-24 |

All seed rows have `publication_date = last_update = created_at` (past dates, so no scheduled jobs are created).

---

## SQLite Configuration

```javascript
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

| Pragma | Value | Reason |
|---|---|---|
| `journal_mode` | `WAL` | Write-Ahead Logging allows concurrent reads without blocking writes |
| `foreign_keys` | `ON` | Enforces `ON DELETE CASCADE` from `notification_jobs` to `announcements` |

---

## Entity Relationship Diagram

```
announcements
  ┌─────────────────────────────────────┐
  │ id (PK)                             │
  │ title                               │
  │ body                                │
  │ publication_date                    │
  │ last_update                         │
  │ categories  (JSON text)             │
  │ created_at                          │
  └──────────────┬──────────────────────┘
                 │  1
                 │
                 │  0..1
  ┌──────────────▼──────────────────────┐
  │ notification_jobs                   │
  │ id (PK)                             │
  │ announcement_id (FK, UNIQUE)        │
  │ scheduled_for                       │
  │ fired_at (nullable)                 │
  └─────────────────────────────────────┘
```

---

## See Also

- [Backend Structure](../backend/structure.md)
- [Scheduler Lifecycle](../backend/scheduler.md)
- [REST API Reference](../api/rest.md)

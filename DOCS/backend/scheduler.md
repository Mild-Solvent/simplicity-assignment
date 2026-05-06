# ⏰ Notification Scheduler

**File:** `src/scheduler/notificationScheduler.js`

The scheduler manages deferred WebSocket broadcasts. When an announcement's `publication_date` is in the future, the notification is not sent immediately — instead it is persisted to the database and fired at the exact moment the date arrives, even across server restarts.

---

## Design Goals

| Goal | Implementation |
|---|---|
| Exact-time delivery | `node-schedule.scheduleJob(Date)` — not cron-based, fires once at the specified `Date` |
| Durability across restarts | Pending jobs are stored in the `notification_jobs` DB table; `initScheduler()` re-queues on boot |
| No duplicate toasts | Missed jobs (server was down when the date passed) are marked fired but **not re-broadcast** |
| Clean cancellation | Cancelling/deleting an announcement also cancels its in-memory job and removes the DB row |

---

## In-Memory State

```javascript
const activeJobs = new Map(); // announcementId (number) → node-schedule Job
```

This map is the source of truth for currently scheduled jobs. It is lost on server restart — that's why the DB table exists.

---

## Public API

### `scheduleOrBroadcast(announcement)`

Called immediately after a successful `POST /api/announcements`.

```
publication_date ≤ now?
  YES → broadcast({ type: 'NEW_ANNOUNCEMENT', data: announcement })
  NO  → upsertJobRow(id, publication_date)
        createJob(id, pubDate)
```

### `rescheduleJob(announcement)`

Called immediately after a successful `PUT /api/announcements/:id`.

```
existing in-memory job?
  YES → cancel + delete from activeJobs

new publication_date ≤ now?
  YES → deleteJobRow(id)          ← no new broadcast on edit
  NO  → upsertJobRow(id, new_pub)
        createJob(id, new_pub)
```

> **Why no broadcast on edit?** Re-broadcasting would send a notification for an announcement that has already been seen. The scheduler only fires the initial "something was published" event.

### `cancelJob(announcementId)`

Called immediately before `DELETE /api/announcements/:id`.

```
in-memory job exists?
  YES → cancel + delete from activeJobs
deleteJobRow(id)
```

### `initScheduler()`

Called once at server startup, after the HTTP server begins listening.

```
SELECT * FROM notification_jobs WHERE fired_at IS NULL

for each pending row:
  scheduled_for > now?
    YES → createJob(id, fireAt)         ← re-queue
    NO  → markFired(id)                 ← missed; skip re-broadcast
```

---

## Internal Helpers

### `upsertJobRow(announcementId, scheduledFor)`
```sql
INSERT INTO notification_jobs (announcement_id, scheduled_for, fired_at)
VALUES (?, ?, NULL)
ON CONFLICT(announcement_id) DO UPDATE SET
  scheduled_for = excluded.scheduled_for,
  fired_at      = NULL
```
The `ON CONFLICT` clause handles re-scheduling after an edit without needing a separate UPDATE.

### `markFired(announcementId)`
```sql
UPDATE notification_jobs SET fired_at = ? WHERE announcement_id = ?
```
Sets `fired_at` to the current ISO timestamp. Rows with `fired_at IS NOT NULL` are considered done and will not be re-queued on the next restart.

### `deleteJobRow(announcementId)`
```sql
DELETE FROM notification_jobs WHERE announcement_id = ?
```
Used when an announcement is deleted (though `ON DELETE CASCADE` would also handle it) and when a reschedule finds that the new date is in the past.

### `createJob(announcementId, fireAt: Date)`

Calls `node-schedule.scheduleJob(fireAt, callback)`. The callback:
1. Fetches the latest announcement row from the DB (in case it was edited between scheduling and firing)
2. Calls `broadcast({ type: 'NEW_ANNOUNCEMENT', data })`
3. Calls `markFired(announcementId)`
4. Removes the job from `activeJobs`

If `node-schedule` returns `null` (which happens if `fireAt` is in the past by the time `scheduleJob` is called), the DB row is deleted and a warning is logged.

---

## Full Lifecycle Diagram

```
POST /api/announcements
  │
  ├─ pubDate ≤ now ──────────────────────────────────────────► broadcast()
  │                                                              └─► WS toast on all clients
  │
  └─ pubDate > now
       │
       ├─► upsertJobRow (notification_jobs)
       │     announcement_id, scheduled_for, fired_at = NULL
       │
       └─► createJob (node-schedule)
             │
             (time passes...)
             │
             └─► at pubDate:
                   fetch announcement from DB
                   broadcast()
                   markFired()
                   activeJobs.delete(id)


PUT /api/announcements/:id
  │
  ├─ cancel existing activeJobs.get(id) if present
  │
  ├─ new pubDate ≤ now ─────────────────────────────────────► deleteJobRow (no re-broadcast)
  │
  └─ new pubDate > now
       └─► upsertJobRow + createJob (same as POST flow)


DELETE /api/announcements/:id
  │
  ├─ cancel activeJobs.get(id) if present
  └─► deleteJobRow (also cascades from DB FK)


Server restart
  │
  └─► initScheduler()
        │
        ├─ scheduled_for > now ───────────────────────────────► createJob() re-queue
        └─ scheduled_for ≤ now ───────────────────────────────► markFired() (no re-broadcast)
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Server down when `pubDate` passes | Job is skipped on restart (`markFired`, no broadcast) — the notification was already sent at creation via the immediate broadcast path... wait, no — if the original pubDate was in the future at creation, it was scheduled, not broadcast. If the server misses it, clients do **not** receive the toast. This is a known limitation of the current design. |
| Two edits in quick succession | Each `PUT` cancels the previous job before creating a new one; only one job exists at a time per announcement |
| Announcement deleted before scheduled time | `cancelJob` runs before `DELETE FROM announcements`; no orphan job remains |
| `node-schedule` returns `null` | Logged as a warning; DB row is deleted; no job registered |

---

## See Also

- [WebSocket Protocol](../api/websocket.md)
- [Database Schema](../database/schema.md)
- [Backend Structure](./structure.md)

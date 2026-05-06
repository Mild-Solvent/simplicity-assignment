-- Migration 002: Create notification_jobs table for scheduled WS notifications
CREATE TABLE IF NOT EXISTS notification_jobs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id  INTEGER NOT NULL UNIQUE,
  scheduled_for    TEXT    NOT NULL,  -- ISO timestamp: when to broadcast
  fired_at         TEXT,              -- NULL = pending, ISO timestamp when fired
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Migration 001: Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  body             TEXT    NOT NULL,
  publication_date TEXT    NOT NULL,
  last_update      TEXT    NOT NULL,
  categories       TEXT    NOT NULL,  -- JSON array, e.g. '["City","Health"]'
  created_at       TEXT    NOT NULL
);

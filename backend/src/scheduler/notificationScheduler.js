/**
 * Notification Scheduler
 *
 * Manages deferred WebSocket broadcasts tied to announcement publication_date.
 *
 * Rules:
 *  - publication_date <= now  → broadcast immediately
 *  - publication_date >  now  → persist to notification_jobs, schedule via node-schedule
 *
 * Jobs survive server restarts: initScheduler() re-queues all pending rows on boot.
 */

const schedule = require('node-schedule');
const db = require('../db/database');
const { broadcast } = require('../ws/notifier');

/** In-memory map of announcementId → node-schedule Job */
const activeJobs = new Map();

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseAnnouncement(row) {
  if (!row) return null;
  return { ...row, categories: JSON.parse(row.categories) };
}

/** Persist a pending job row (upsert — handles re-schedules after edits). */
function upsertJobRow(announcementId, scheduledFor) {
  db.prepare(`
    INSERT INTO notification_jobs (announcement_id, scheduled_for, fired_at)
    VALUES (?, ?, NULL)
    ON CONFLICT(announcement_id) DO UPDATE SET
      scheduled_for = excluded.scheduled_for,
      fired_at      = NULL
  `).run(announcementId, scheduledFor);
}

/** Mark a job row as fired. */
function markFired(announcementId) {
  db.prepare(
    'UPDATE notification_jobs SET fired_at = ? WHERE announcement_id = ?'
  ).run(new Date().toISOString(), announcementId);
}

/** Remove a job row from the DB entirely. */
function deleteJobRow(announcementId) {
  db.prepare('DELETE FROM notification_jobs WHERE announcement_id = ?').run(announcementId);
}

/** Create a node-schedule job for the given announcement at the given Date. */
function createJob(announcementId, fireAt) {
  const job = schedule.scheduleJob(fireAt, () => {
    console.log(`🔔 Firing scheduled notification for announcement #${announcementId}`);

    const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(announcementId);
    if (row) {
      broadcast({ type: 'NEW_ANNOUNCEMENT', data: parseAnnouncement(row) });
    }

    markFired(announcementId);
    activeJobs.delete(announcementId);
  });

  if (job) {
    activeJobs.set(announcementId, job);
    console.log(`⏰ Notification scheduled for announcement #${announcementId} at ${fireAt.toISOString()}`);
  } else {
    // node-schedule returns null if the date is in the past
    console.warn(`⚠️  Could not schedule job for announcement #${announcementId} — date may be in the past`);
    deleteJobRow(announcementId);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called after creating a new announcement.
 * Broadcasts immediately if publication_date <= now, otherwise schedules.
 */
function scheduleOrBroadcast(announcement) {
  const pubDate = new Date(announcement.publication_date);
  const now = new Date();

  if (pubDate <= now) {
    // Past or present → fire now
    broadcast({ type: 'NEW_ANNOUNCEMENT', data: announcement });
    return;
  }

  // Future → schedule
  upsertJobRow(announcement.id, announcement.publication_date);
  createJob(announcement.id, pubDate);
}

/**
 * Called after editing an announcement.
 * Cancels any existing pending job and re-evaluates with the new publication_date.
 */
function rescheduleJob(announcement) {
  // Cancel existing in-memory job if present
  const existing = activeJobs.get(announcement.id);
  if (existing) {
    existing.cancel();
    activeJobs.delete(announcement.id);
    console.log(`🗑️  Cancelled existing job for announcement #${announcement.id}`);
  }

  const pubDate = new Date(announcement.publication_date);
  const now = new Date();

  if (pubDate <= now) {
    // New date is also in the past → clean up DB row, no new broadcast on edit
    deleteJobRow(announcement.id);
    return;
  }

  // New date is in the future → persist and schedule
  upsertJobRow(announcement.id, announcement.publication_date);
  createJob(announcement.id, pubDate);
}

/**
 * Called before deleting an announcement.
 * Cancels any pending in-memory job and removes the DB row.
 */
function cancelJob(announcementId) {
  const existing = activeJobs.get(announcementId);
  if (existing) {
    existing.cancel();
    activeJobs.delete(announcementId);
    console.log(`🗑️  Cancelled scheduled notification for announcement #${announcementId}`);
  }
  deleteJobRow(announcementId);
}

/**
 * Called once at server startup.
 * Re-queues all pending (not yet fired) notification jobs from the DB.
 */
function initScheduler() {
  const pending = db.prepare(
    'SELECT * FROM notification_jobs WHERE fired_at IS NULL'
  ).all();

  if (pending.length === 0) {
    console.log('⏰ No pending scheduled notifications.');
    return;
  }

  console.log(`⏰ Re-queuing ${pending.length} pending notification(s) from DB…`);

  for (const job of pending) {
    const fireAt = new Date(job.scheduled_for);
    const now = new Date();

    if (fireAt <= now) {
      // Missed while server was down → fire immediately now
      console.log(`⚡ Firing missed notification for announcement #${job.announcement_id}`);
      const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(job.announcement_id);
      if (row) {
        broadcast({ type: 'NEW_ANNOUNCEMENT', data: parseAnnouncement(row) });
      }
      markFired(job.announcement_id);
    } else {
      createJob(job.announcement_id, fireAt);
    }
  }
}

module.exports = { scheduleOrBroadcast, rescheduleJob, cancelJob, initScheduler };

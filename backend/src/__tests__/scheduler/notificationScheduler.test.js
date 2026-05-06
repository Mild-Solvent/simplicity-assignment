jest.mock('node-schedule', () => ({
  scheduleJob: jest.fn(() => ({ cancel: jest.fn() })),
}));

jest.mock('../../ws/notifier', () => ({
  broadcast: jest.fn(),
}));

jest.mock('../../db/database', () => {
  const Database = require('better-sqlite3');
  const { runMigrations } = require('../../db/migrate');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
});

const schedule = require('node-schedule');
const { broadcast } = require('../../ws/notifier');
const db = require('../../db/database');
const {
  scheduleOrBroadcast,
  rescheduleJob,
  cancelJob,
  initScheduler,
} = require('../../scheduler/notificationScheduler');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function insertAnnouncement({ publication_date } = {}) {
  const pub = publication_date ?? new Date(Date.now() + 60_000).toISOString();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO announcements (title, body, publication_date, last_update, categories, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run('Test', 'body', pub, now, JSON.stringify(['City']), now);
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
  return { ...row, categories: JSON.parse(row.categories) };
}

function getJobRow(announcementId) {
  return db
    .prepare('SELECT * FROM notification_jobs WHERE announcement_id = ?')
    .get(announcementId);
}

beforeEach(() => {
  db.prepare('DELETE FROM announcements').run();
  db.prepare('DELETE FROM notification_jobs').run();
  jest.clearAllMocks();
});

// ─── scheduleOrBroadcast ──────────────────────────────────────────────────────

describe('scheduleOrBroadcast', () => {
  test('broadcasts immediately when publication_date is in the past', () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const ann = insertAnnouncement({ publication_date: pastDate });

    scheduleOrBroadcast(ann);

    expect(broadcast).toHaveBeenCalledWith({ type: 'NEW_ANNOUNCEMENT', data: ann });
    expect(schedule.scheduleJob).not.toHaveBeenCalled();
    expect(getJobRow(ann.id)).toBeUndefined();
  });

  test('broadcasts immediately when publication_date equals now (edge: past <= now)', () => {
    // Use a date that's clearly in the past by a small margin
    const ann = insertAnnouncement({ publication_date: new Date(Date.now() - 1).toISOString() });

    scheduleOrBroadcast(ann);

    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  test('creates a scheduled job when publication_date is in the future', () => {
    const ann = insertAnnouncement(); // default: 60s in the future

    scheduleOrBroadcast(ann);

    expect(broadcast).not.toHaveBeenCalled();
    expect(schedule.scheduleJob).toHaveBeenCalledTimes(1);
  });

  test('persists a notification_jobs row for future announcements', () => {
    const ann = insertAnnouncement();

    scheduleOrBroadcast(ann);

    const jobRow = getJobRow(ann.id);
    expect(jobRow).toBeDefined();
    expect(jobRow.fired_at).toBeNull();
    expect(jobRow.scheduled_for).toBe(ann.publication_date);
  });

  test('does NOT persist a job row for past announcements', () => {
    const ann = insertAnnouncement({ publication_date: new Date(Date.now() - 60_000).toISOString() });

    scheduleOrBroadcast(ann);

    expect(getJobRow(ann.id)).toBeUndefined();
  });
});

// ─── rescheduleJob ────────────────────────────────────────────────────────────

describe('rescheduleJob', () => {
  test('cancels an existing in-memory job when rescheduling', () => {
    const ann = insertAnnouncement(); // future date
    scheduleOrBroadcast(ann); // seeds activeJobs
    const originalMockJob = schedule.scheduleJob.mock.results[0].value;

    jest.clearAllMocks();
    rescheduleJob(ann); // new future date (same announcement)

    expect(originalMockJob.cancel).toHaveBeenCalled();
  });

  test('creates a new scheduled job when new date is in the future', () => {
    const ann = insertAnnouncement();
    rescheduleJob(ann);

    expect(schedule.scheduleJob).toHaveBeenCalledTimes(1);
    expect(getJobRow(ann.id)).toBeDefined();
  });

  test('removes DB row and does NOT schedule when new date is in the past', () => {
    // First schedule a future job
    const futureAnn = insertAnnouncement();
    scheduleOrBroadcast(futureAnn);
    expect(getJobRow(futureAnn.id)).toBeDefined();

    jest.clearAllMocks();

    // Now reschedule to a past date
    const pastAnn = { ...futureAnn, publication_date: new Date(Date.now() - 60_000).toISOString() };
    rescheduleJob(pastAnn);

    expect(schedule.scheduleJob).not.toHaveBeenCalled();
    expect(getJobRow(futureAnn.id)).toBeUndefined();
  });

  test('does NOT re-broadcast on reschedule to past date', () => {
    const pastAnn = insertAnnouncement({ publication_date: new Date(Date.now() - 60_000).toISOString() });
    rescheduleJob(pastAnn);

    expect(broadcast).not.toHaveBeenCalled();
  });
});

// ─── cancelJob ───────────────────────────────────────────────────────────────

describe('cancelJob', () => {
  test('removes the notification_jobs DB row', () => {
    const ann = insertAnnouncement();
    scheduleOrBroadcast(ann); // creates DB row
    expect(getJobRow(ann.id)).toBeDefined();

    jest.clearAllMocks();
    cancelJob(ann.id);

    expect(getJobRow(ann.id)).toBeUndefined();
  });

  test('cancels the in-memory node-schedule job', () => {
    const ann = insertAnnouncement();
    scheduleOrBroadcast(ann);
    const mockJob = schedule.scheduleJob.mock.results[0].value;

    jest.clearAllMocks();
    cancelJob(ann.id);

    expect(mockJob.cancel).toHaveBeenCalled();
  });

  test('is a no-op when no job exists (does not throw)', () => {
    expect(() => cancelJob(9999)).not.toThrow();
  });
});

// ─── initScheduler ────────────────────────────────────────────────────────────

describe('initScheduler', () => {
  test('re-queues pending future jobs from the DB', () => {
    const ann = insertAnnouncement(); // future date
    // Manually insert a pending notification_jobs row (simulating server restart)
    db.prepare(
      `INSERT INTO notification_jobs (announcement_id, scheduled_for, fired_at) VALUES (?, ?, NULL)`
    ).run(ann.id, ann.publication_date);

    initScheduler();

    expect(schedule.scheduleJob).toHaveBeenCalledTimes(1);
  });

  test('marks missed (past) jobs as fired without re-broadcasting', () => {
    const ann = insertAnnouncement({ publication_date: new Date(Date.now() - 60_000).toISOString() });
    db.prepare(
      `INSERT INTO notification_jobs (announcement_id, scheduled_for, fired_at) VALUES (?, ?, NULL)`
    ).run(ann.id, ann.publication_date);

    initScheduler();

    expect(broadcast).not.toHaveBeenCalled();
    expect(schedule.scheduleJob).not.toHaveBeenCalled();

    const jobRow = getJobRow(ann.id);
    expect(jobRow.fired_at).not.toBeNull();
  });

  test('does nothing when no pending jobs exist', () => {
    initScheduler();
    expect(schedule.scheduleJob).not.toHaveBeenCalled();
  });
});

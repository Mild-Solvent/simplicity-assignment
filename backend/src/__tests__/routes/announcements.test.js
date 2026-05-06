// Mock the DB with an in-memory SQLite instance before any other requires
jest.mock('../../db/database', () => {
  const Database = require('better-sqlite3');
  const { runMigrations } = require('../../db/migrate');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
});

// Mock the scheduler — tested separately
jest.mock('../../scheduler/notificationScheduler', () => ({
  scheduleOrBroadcast: jest.fn(),
  rescheduleJob: jest.fn(),
  cancelJob: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const router = require('../../routes/announcements');
const {
  scheduleOrBroadcast,
  rescheduleJob,
  cancelJob,
} = require('../../scheduler/notificationScheduler');
const db = require('../../db/database');

const app = express();
app.use(express.json());
app.use('/api/announcements', router);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function insert({
  title = 'Test Announcement',
  body = 'Test body content',
  publication_date = '2023-01-01T00:00:00.000Z',
  last_update = '2023-01-01T00:00:00.000Z',
  categories = ['City'],
  created_at = '2023-01-01T00:00:00.000Z',
} = {}) {
  const result = db
    .prepare(
      `INSERT INTO announcements (title, body, publication_date, last_update, categories, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title, body, publication_date, last_update, JSON.stringify(categories), created_at);
  return db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
}

beforeEach(() => {
  db.prepare('DELETE FROM announcements').run();
  jest.clearAllMocks();
});

// ─── GET /api/announcements ───────────────────────────────────────────────────

describe('GET /api/announcements', () => {
  test('returns empty list with correct pagination shape', async () => {
    const res = await request(app).get('/api/announcements');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toEqual({ total: 0, page: 1, limit: 10, totalPages: 0 });
  });

  test('returns announcements with categories parsed from JSON', async () => {
    insert({ title: 'Park Closure', categories: ['City', 'Health'] });
    const res = await request(app).get('/api/announcements');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Park Closure');
    expect(res.body.data[0].categories).toEqual(['City', 'Health']);
  });

  test('calculates pagination correctly', async () => {
    for (let i = 1; i <= 12; i++) insert({ title: `Item ${i}` });
    const res = await request(app).get('/api/announcements?page=2&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination).toEqual({ total: 12, page: 2, limit: 5, totalPages: 3 });
  });

  test('returns 400 when page=0 (below minimum)', async () => {
    const res = await request(app).get('/api/announcements?page=0');
    expect(res.status).toBe(400);
  });

  test('returns 400 when limit exceeds 100', async () => {
    const res = await request(app).get('/api/announcements?limit=101');
    expect(res.status).toBe(400);
  });

  test('search matches title case-insensitively', async () => {
    insert({ title: 'Road Closure Notice', body: 'Downtown closed' });
    insert({ title: 'Health Screening', body: 'Free checkup' });
    const res = await request(app).get('/api/announcements?search=road');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Road Closure Notice');
  });

  test('search also matches body content', async () => {
    insert({ title: 'Update A', body: 'emergency preparedness workshop' });
    insert({ title: 'Update B', body: 'regular community meeting' });
    const res = await request(app).get('/api/announcements?search=emergency');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('category filter narrows results', async () => {
    insert({ title: 'City News', categories: ['City'] });
    insert({ title: 'Health News', categories: ['Health'] });
    const res = await request(app).get('/api/announcements?category=Health');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Health News');
  });

  test('comma-separated categories apply OR logic', async () => {
    insert({ title: 'City Only', categories: ['City'] });
    insert({ title: 'Health Only', categories: ['Health'] });
    insert({ title: 'Culture Only', categories: ['Culture'] });
    const res = await request(app).get('/api/announcements?category=City,Health');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const titles = res.body.data.map((d) => d.title);
    expect(titles).toContain('City Only');
    expect(titles).toContain('Health Only');
  });

  test('search and category combine as AND', async () => {
    insert({ title: 'City Park Event', body: 'park opening', categories: ['City'] });
    insert({ title: 'Health Park Clinic', body: 'park clinic', categories: ['Health'] });
    const res = await request(app).get('/api/announcements?search=park&category=City');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('City Park Event');
  });

  test('results ordered by last_update descending', async () => {
    insert({ title: 'Older', last_update: '2023-01-01T00:00:00.000Z' });
    insert({ title: 'Newer', last_update: '2024-06-01T00:00:00.000Z' });
    const res = await request(app).get('/api/announcements');
    expect(res.body.data[0].title).toBe('Newer');
    expect(res.body.data[1].title).toBe('Older');
  });
});

// ─── GET /api/announcements/:id ──────────────────────────────────────────────

describe('GET /api/announcements/:id', () => {
  test('returns the announcement with parsed categories', async () => {
    const row = insert({ categories: ['City', 'Health'] });
    const res = await request(app).get(`/api/announcements/${row.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(row.id);
    expect(res.body.categories).toEqual(['City', 'Health']);
  });

  test('returns 404 for non-existent id', async () => {
    const res = await request(app).get('/api/announcements/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Announcement not found');
  });

  test('returns 400 for non-integer id', async () => {
    const res = await request(app).get('/api/announcements/abc');
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/announcements ──────────────────────────────────────────────────

describe('POST /api/announcements', () => {
  const validPayload = {
    title: 'New Announcement',
    body: 'Announcement body text',
    publication_date: '2030-01-01T12:00:00.000Z',
    categories: ['City'],
  };

  test('creates announcement and returns 201 with parsed categories', async () => {
    const res = await request(app).post('/api/announcements').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('New Announcement');
    expect(res.body.categories).toEqual(['City']);
  });

  test('persists to DB', async () => {
    const res = await request(app).post('/api/announcements').send(validPayload);
    const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(res.body.id);
    expect(row).toBeDefined();
    expect(row.title).toBe('New Announcement');
  });

  test('calls scheduleOrBroadcast with the created announcement', async () => {
    const res = await request(app).post('/api/announcements').send(validPayload);
    expect(scheduleOrBroadcast).toHaveBeenCalledTimes(1);
    expect(scheduleOrBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ id: res.body.id, title: 'New Announcement', categories: ['City'] })
    );
  });

  test('returns 400 when title is missing', async () => {
    const { title, ...payload } = validPayload;
    const res = await request(app).post('/api/announcements').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.msg === 'Title is required')).toBe(true);
  });

  test('returns 400 when body is missing', async () => {
    const { body, ...payload } = validPayload;
    const res = await request(app).post('/api/announcements').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.msg === 'Body is required')).toBe(true);
  });

  test('returns 400 when publication_date is missing', async () => {
    const { publication_date, ...payload } = validPayload;
    const res = await request(app).post('/api/announcements').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.msg === 'Publication date is required')).toBe(true);
  });

  test('returns 400 when categories is an empty array', async () => {
    const res = await request(app)
      .post('/api/announcements')
      .send({ ...validPayload, categories: [] });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.msg === 'At least one category is required')).toBe(true);
  });

  test('returns 400 when categories is not an array', async () => {
    const res = await request(app)
      .post('/api/announcements')
      .send({ ...validPayload, categories: 'City' });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /api/announcements/:id ───────────────────────────────────────────────

describe('PUT /api/announcements/:id', () => {
  const updatePayload = {
    title: 'Updated Title',
    body: 'Updated body',
    publication_date: '2025-06-01T00:00:00.000Z',
    categories: ['Health'],
  };

  test('updates announcement and returns updated data', async () => {
    const row = insert();
    const res = await request(app).put(`/api/announcements/${row.id}`).send(updatePayload);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
    expect(res.body.categories).toEqual(['Health']);
  });

  test('persists changes to DB', async () => {
    const row = insert();
    await request(app).put(`/api/announcements/${row.id}`).send(updatePayload);
    const updated = db.prepare('SELECT * FROM announcements WHERE id = ?').get(row.id);
    expect(updated.title).toBe('Updated Title');
    expect(JSON.parse(updated.categories)).toEqual(['Health']);
  });

  test('calls rescheduleJob with updated announcement', async () => {
    const row = insert();
    await request(app).put(`/api/announcements/${row.id}`).send(updatePayload);
    expect(rescheduleJob).toHaveBeenCalledTimes(1);
    expect(rescheduleJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: row.id, title: 'Updated Title' })
    );
  });

  test('returns 404 for non-existent id', async () => {
    const res = await request(app).put('/api/announcements/99999').send(updatePayload);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Announcement not found');
  });

  test('returns 400 for validation errors', async () => {
    const row = insert();
    const res = await request(app)
      .put(`/api/announcements/${row.id}`)
      .send({ ...updatePayload, categories: [] });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/announcements/:id ───────────────────────────────────────────

describe('DELETE /api/announcements/:id', () => {
  test('deletes announcement and returns 204', async () => {
    const row = insert();
    const res = await request(app).delete(`/api/announcements/${row.id}`);
    expect(res.status).toBe(204);
    expect(db.prepare('SELECT * FROM announcements WHERE id = ?').get(row.id)).toBeUndefined();
  });

  test('calls cancelJob with the announcement id', async () => {
    const row = insert();
    await request(app).delete(`/api/announcements/${row.id}`);
    expect(cancelJob).toHaveBeenCalledWith(row.id);
  });

  test('returns 404 for non-existent id', async () => {
    const res = await request(app).delete('/api/announcements/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Announcement not found');
  });

  test('returns 400 for invalid (non-integer) id', async () => {
    const res = await request(app).delete('/api/announcements/abc');
    expect(res.status).toBe(400);
  });
});

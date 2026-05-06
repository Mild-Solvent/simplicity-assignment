const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const db = require('../db/database');
const { broadcast } = require('../ws/notifier');

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

function parseAnnouncement(row) {
  if (!row) return null;
  return {
    ...row,
    categories: JSON.parse(row.categories),
  };
}

// ─── GET /api/announcements ──────────────────────────────────────────────────
// Query params: search, category, page (default 1), limit (default 10)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const search = req.query.search ? String(req.query.search).trim() : '';
    const category = req.query.category ? String(req.query.category).trim() : '';
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let params = [];

    if (search) {
      whereClauses.push('(LOWER(title) LIKE ? OR LOWER(body) LIKE ?)');
      const like = `%${search.toLowerCase()}%`;
      params.push(like, like);
    }

    if (category) {
      // categories stored as JSON array string — use LIKE for simple containment
      whereClauses.push("LOWER(categories) LIKE ?");
      params.push(`%${category.toLowerCase()}%`);
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as c FROM announcements ${where}`).get(...params).c;
    const rows = db.prepare(
      `SELECT * FROM announcements ${where} ORDER BY last_update DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      data: rows.map(parseAnnouncement),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

// ─── GET /api/announcements/:id ──────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).toInt()],
  (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Announcement not found' });
    res.json(parseAnnouncement(row));
  }
);

// ─── POST /api/announcements ─────────────────────────────────────────────────
router.post(
  '/',
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required'),
    body('publication_date').notEmpty().withMessage('Publication date is required'),
    body('categories').isArray({ min: 1 }).withMessage('At least one category is required'),
  ],
  (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const { title, body: bodyText, publication_date, categories } = req.body;
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO announcements (title, body, publication_date, last_update, categories, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, bodyText, publication_date, now, JSON.stringify(categories), now);

    const created = parseAnnouncement(
      db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid)
    );

    // WebSocket broadcast (bonus)
    broadcast({ type: 'NEW_ANNOUNCEMENT', data: created });

    res.status(201).json(created);
  }
);

// ─── PUT /api/announcements/:id ──────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('title').notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required'),
    body('publication_date').notEmpty().withMessage('Publication date is required'),
    body('categories').isArray({ min: 1 }).withMessage('At least one category is required'),
  ],
  (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const row = db.prepare('SELECT id FROM announcements WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Announcement not found' });

    const { title, body: bodyText, publication_date, categories } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE announcements
      SET title = ?, body = ?, publication_date = ?, last_update = ?, categories = ?
      WHERE id = ?
    `).run(title, bodyText, publication_date, now, JSON.stringify(categories), req.params.id);

    const updated = parseAnnouncement(
      db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id)
    );

    res.json(updated);
  }
);

// ─── DELETE /api/announcements/:id ───────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 }).toInt()],
  (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const row = db.prepare('SELECT id FROM announcements WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Announcement not found' });

    db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
    res.status(204).send();
  }
);

module.exports = router;

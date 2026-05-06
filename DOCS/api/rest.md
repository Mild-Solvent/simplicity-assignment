# 🔗 REST API Reference

Base URL: `http://localhost:3001/api`

All request bodies and responses use **JSON**. All timestamps are **ISO 8601** strings (e.g. `"2026-06-01T10:00:00.000Z"`).

---

## Announcement Object

Every endpoint that returns announcement data uses this shape:

```json
{
  "id": 1,
  "title": "New Park Opening",
  "body": "The new park will open on Saturday.",
  "publication_date": "2026-06-01T10:00:00.000Z",
  "last_update": "2026-05-06T18:00:00.000Z",
  "categories": ["City", "Community events"],
  "created_at": "2026-05-06T18:00:00.000Z"
}
```

> **`categories`** is stored as a JSON array in SQLite but is always parsed to a native array before being returned.

---

## Endpoints

### `GET /api/announcements`

List announcements with optional filtering and pagination.

**Query Parameters**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | Page number |
| `limit` | integer 1–100 | `10` | Results per page |
| `search` | string | — | Case-insensitive full-text match on `title` and `body` |
| `category` | string | — | Comma-separated list of categories. A row matches if it belongs to **any** of the listed categories |

**Example request:**
```
GET /api/announcements?page=1&limit=10&search=park&category=City,Health
```

**Response: `200 OK`**
```json
{
  "data": [ /* Announcement[] */ ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### `GET /api/announcements/:id`

Fetch a single announcement by its numeric ID.

**Response: `200 OK`** — Announcement object.

**Response: `404 Not Found`**
```json
{ "error": "Announcement not found" }
```

---

### `POST /api/announcements`

Create a new announcement.

**Request body:**
```json
{
  "title": "string (required)",
  "body":  "string (required)",
  "publication_date": "ISO 8601 string (required)",
  "categories": ["string", "..."]  // at least one item required
}
```

**Side effects:**
- If `publication_date ≤ now` → WebSocket broadcast fires immediately
- If `publication_date > now` → a `notification_jobs` row is created; broadcast fires at that time

**Response: `201 Created`** — the newly created Announcement object.

**Response: `400 Bad Request`** (validation failure):
```json
{
  "errors": [
    { "type": "field", "msg": "Title is required", "path": "title", ... }
  ]
}
```

---

### `PUT /api/announcements/:id`

Update an existing announcement.

**Request body:** Same shape as `POST`.

**Side effects:**
- Any previously scheduled notification for this announcement is **cancelled**
- The new `publication_date` is re-evaluated:
  - If `≤ now` → no new broadcast (edit does not re-notify)
  - If `> now` → a new scheduled job is created

**Response: `200 OK`** — the updated Announcement object.

**Response: `404 Not Found`** if the ID does not exist.

---

### `DELETE /api/announcements/:id`

Delete an announcement.

**Side effects:**
- Any pending scheduled notification is cancelled (in-memory job + DB row)
- The announcement row is deleted; the `notification_jobs` row cascades automatically via `ON DELETE CASCADE`

**Response: `204 No Content`**

**Response: `404 Not Found`** if the ID does not exist.

---

## Validation Rules

| Field | Rule |
|---|---|
| `title` | `notEmpty()` — must be a non-empty string |
| `body` | `notEmpty()` — must be a non-empty string |
| `publication_date` | `notEmpty()` — must be a non-empty string; expected ISO 8601 |
| `categories` | `isArray({ min: 1 })` — must be an array with at least one element |
| `page` (query) | Optional, `isInt({ min: 1 })` |
| `limit` (query) | Optional, `isInt({ min: 1, max: 100 })` |
| `:id` (param) | `isInt({ min: 1 })` |

---

## Health Check

```
GET /
```

**Response: `200 OK`**
```json
{ "status": "ok", "message": "Announcements API is running" }
```

---

## Available Category Values

The frontend exposes these predefined categories (free-text is also technically accepted by the API):

```
City
Community events
Crime & Safety
Culture
Discounts & Benefits
Emergencies
For Seniors
Health
Kids & Family
```

---

## See Also

- [WebSocket Protocol](./websocket.md)
- [Architecture Overview](../architecture/overview.md)

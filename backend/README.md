# Announcements API — Backend Documentation

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher

---

## Installation & Running

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Start development server (auto-reloads on file change)
npm run dev

# OR start in production mode
npm start
```

The server starts on **http://localhost:3001** by default.  
Set the `PORT` environment variable to use a different port.

On first start, the SQLite database is created automatically at `data/announcements.db` and seeded with 10 sample announcements.

---

## WebSocket

A WebSocket server runs on the **same port** as the HTTP server.

Connect to: `ws://localhost:3001`

### Events emitted by the server

| Event type | When | Payload |
|---|---|---|
| `NEW_ANNOUNCEMENT` | A new announcement is created via `POST /api/announcements` | `{ type: "NEW_ANNOUNCEMENT", data: <announcement object> }` |

---

## API Endpoints

Base URL: `http://localhost:3001/api`

---

### `GET /api/announcements`

Returns a paginated list of announcements, sorted by `last_update` descending.

#### Query Parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page (max 100) |
| `search` | string | — | Full-text search across `title` and `body` |
| `category` | string | — | Filter by category name (case-insensitive) |

#### Example Request

```
GET /api/announcements?page=1&limit=10&search=city&category=Health
```

#### Example Response

```json
{
  "data": [
    {
      "id": 7,
      "title": "Title 7",
      "body": "Free health screening available at the community center.",
      "publication_date": "2023-03-24T07:27:00.000Z",
      "last_update": "2023-03-24T07:27:00.000Z",
      "categories": ["City", "Health"],
      "created_at": "2023-03-24T07:27:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### `GET /api/announcements/:id`

Returns a single announcement by ID.

#### Example Response

```json
{
  "id": 1,
  "title": "Title 1",
  "body": "Community update about city improvements.",
  "publication_date": "2023-08-11T04:38:00.000Z",
  "last_update": "2023-08-11T04:38:00.000Z",
  "categories": ["City"],
  "created_at": "2023-08-11T04:38:00.000Z"
}
```

---

### `POST /api/announcements`

Creates a new announcement and broadcasts a WebSocket notification.

#### Request Body

```json
{
  "title": "New Road Works",
  "body": "Road maintenance starts Monday on Main Street.",
  "publication_date": "2024-01-15T08:00:00.000Z",
  "categories": ["City", "Community events"]
}
```

#### Response — `201 Created`

```json
{
  "id": 11,
  "title": "New Road Works",
  "body": "Road maintenance starts Monday on Main Street.",
  "publication_date": "2024-01-15T08:00:00.000Z",
  "last_update": "2024-01-15T10:30:00.000Z",
  "categories": ["City", "Community events"],
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

---

### `PUT /api/announcements/:id`

Updates an existing announcement. Sets `last_update` to current time.

#### Request Body (same schema as POST)

```json
{
  "title": "Updated Road Works",
  "body": "Road works extended until Thursday.",
  "publication_date": "2024-01-15T08:00:00.000Z",
  "categories": ["City"]
}
```

#### Response — `200 OK`

Returns the updated announcement object.

---

### `DELETE /api/announcements/:id`

Deletes an announcement permanently.

#### Response — `204 No Content`

---

## Error Responses

All error responses follow this format:

```json
{ "error": "Announcement not found" }
```

Validation errors:

```json
{
  "errors": [
    { "msg": "Title is required", "path": "title", ... }
  ]
}
```

---

## Testing with Postman

1. Import Postman and create a new **Collection** called `Announcements API`.
2. Set the base URL variable to `http://localhost:3001`.

### Quick curl examples

```bash
# List announcements (page 1)
curl http://localhost:3001/api/announcements

# Search by text
curl "http://localhost:3001/api/announcements?search=health"

# Filter by category
curl "http://localhost:3001/api/announcements?category=City"

# Get single
curl http://localhost:3001/api/announcements/1

# Create
curl -X POST http://localhost:3001/api/announcements \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Test body","publication_date":"2024-01-01T10:00:00.000Z","categories":["City"]}'

# Update
curl -X PUT http://localhost:3001/api/announcements/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated","body":"Updated body","publication_date":"2024-01-01T10:00:00.000Z","categories":["Health"]}'

# Delete
curl -X DELETE http://localhost:3001/api/announcements/1
```

---

## Available Categories

```
City, Community events, Crime & Safety, Culture,
Discounts & Benefits, Emergencies, For Seniors,
Health, Kids & Family
```

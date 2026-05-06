# 📢 Announcements Dashboard

A fullstack **Announcements management dashboard** built as an assignment for Simplicity. It lets city administrators create, edit, search, and delete public announcements, with **real-time WebSocket notifications** and **scheduled publishing** support.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📋 **Announcements table** | Paginated list with server-side search and multi-category filtering |
| ✏️ **CRUD editor** | Create / edit announcements with live notification preview |
| 🔔 **Real-time toasts** | WebSocket push notifications fire on publish |
| ⏰ **Scheduled publishing** | Set a future date; the notification fires automatically at that time |
| 🗄️ **SQLite persistence** | Zero-config embedded database with automatic migrations |
| 🔄 **Restart-safe scheduler** | Pending jobs are re-queued from the DB on every server boot |

---

## 🗂️ Monorepo Structure

```
simplicity-assignment/
├── frontend/          # React 19 + Vite SPA
├── backend/           # Node.js + Express + SQLite API
├── data/              # SQLite database file (git-ignored, auto-created)
└── DOCS/              # Extended documentation
    ├── architecture/
    ├── api/
    ├── frontend/
    ├── backend/
    └── database/
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### 1 — Start the Backend

```bash
cd backend
npm install
npm run dev
```

The API will be available at `http://localhost:3001`.  
The WebSocket server runs on the same port: `ws://localhost:3001`.

### 2 — Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app opens at **`http://localhost:5173`**.

> **Both servers must run simultaneously** — the frontend calls the backend REST API and connects to its WebSocket server.

---

## 🔌 Ports at a Glance

| Service | URL |
|---|---|
| Frontend (Vite dev server) | `http://localhost:5173` |
| Backend REST API | `http://localhost:3001/api` |
| WebSocket | `ws://localhost:3001` |

---

## 🛠️ Tech Stack

### Frontend
- **React 19** — UI framework
- **Vite 8** — build tool / dev server
- **React Router v7** — client-side routing
- **TanStack Table v8** — headless table logic
- **react-select** — multi-value category dropdowns
- **Axios** — HTTP client
- **Vanilla CSS** — custom design system (no CSS framework)

### Backend
- **Node.js + Express 5** — HTTP server
- **better-sqlite3** — synchronous SQLite driver
- **ws** — WebSocket server
- **node-schedule** — cron/date-based job scheduling
- **express-validator** — request validation
- **nodemon** — development auto-restart

---

## 📄 Documentation

Detailed documentation lives in the [`DOCS/`](./DOCS/README.md) folder:

| Document | Description |
|---|---|
| [Architecture Overview](./DOCS/architecture/overview.md) | System design, data flow, component relationships |
| [API Reference](./DOCS/api/rest.md) | All REST endpoints with request/response examples |
| [WebSocket Protocol](./DOCS/api/websocket.md) | WS message format and event types |
| [Frontend Guide](./DOCS/frontend/structure.md) | Component tree, routing, state management |
| [Backend Guide](./DOCS/backend/structure.md) | Module breakdown, middleware, error handling |
| [Database Schema](./DOCS/database/schema.md) | Tables, columns, migrations, seeding |
| [Scheduler](./DOCS/backend/scheduler.md) | Scheduled notification lifecycle |

---

## 🏗️ Development Workflow

```
# In terminal 1 (backend)
cd backend && npm run dev

# In terminal 2 (frontend)
cd frontend && npm run dev
```

The backend seeds 10 sample announcements automatically on first run.

---

## 📝 License

ISC — see individual `package.json` files.

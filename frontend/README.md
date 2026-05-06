# 🖥️ Frontend — Announcements Dashboard

React 19 single-page application built with **Vite**. Provides the full UI for managing city announcements: a searchable/paginated table, a create/edit form with live preview, and real-time WebSocket toast notifications.

---

## ✨ Features

- **Searchable, paginated table** — full-text search + multi-category filter; resets to page 1 on every filter change
- **Create / Edit form** — two-column layout with a live notification preview panel
- **Live notification preview** — mirrors the real toast exactly as you type (title, body, categories)
- **Auto-formatting date input** — digits-only entry; slashes and colons are inserted automatically (`MM/DD/YYYY HH:mm`)
- **Real-time toast notifications** — WebSocket connection shows a 🔔 toast on every `NEW_ANNOUNCEMENT` event
- **Singleton WebSocket** — one shared connection across all hook instances; survives React StrictMode double-mount and auto-reconnects after disconnect
- **Portfolio popup** — cookie-style promo popup on first visit (dismisses per session)

---

## 📁 Project Structure

```
frontend/
├── index.html                  # Vite entry point
├── vite.config.js              # Vite configuration
├── eslint.config.js            # ESLint rules
├── package.json
└── src/
    ├── main.jsx                # React root mount
    ├── App.jsx                 # Router + shell layout
    ├── index.css               # Global design system (variables, layout, components)
    ├── App.css                 # (minimal) App-level overrides
    ├── api/
    │   └── announcements.js    # Axios HTTP client (CRUD)
    ├── hooks/
    │   └── useWebSocket.js     # Singleton WS hook with auto-reconnect
    ├── components/
    │   ├── AnnouncementsTable.jsx  # TanStack Table + filter bar + pagination
    │   ├── NotificationToast.jsx   # Toast stack driven by WS events
    │   ├── Sidebar.jsx             # Navigation sidebar
    │   └── PortfolioPopup.jsx      # First-visit portfolio promotion popup
    └── pages/
        ├── AnnouncementsPage.jsx   # List page (manages state, calls API)
        └── EditAnnouncementPage.jsx # Create/Edit form + live preview panel
```

---

## 🚀 Getting Started

```bash
npm install
npm run dev        # dev server on http://localhost:5173
npm run build      # production bundle
npm run preview    # serve production bundle locally
npm run lint       # ESLint check
```

> **Requires the backend to be running** at `http://localhost:3001`.

---

## 🗺️ Routes

| Path | Component | Description |
|---|---|---|
| `/` | — | Redirects to `/announcements` |
| `/announcements` | `AnnouncementsPage` | Paginated, filterable announcement list |
| `/announcements/new` | `EditAnnouncementPage` | Create a new announcement |
| `/announcements/:id` | `EditAnnouncementPage` | Edit an existing announcement |

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2 | UI framework |
| `react-dom` | ^19.2 | DOM renderer |
| `react-router-dom` | ^7.15 | Client-side routing |
| `@tanstack/react-table` | ^8.21 | Headless table (sorting, pagination) |
| `react-select` | ^5.10 | Multi-value select dropdowns |
| `axios` | ^1.16 | HTTP client |
| `vite` | ^8.0 | Build tool + dev server |
| `@vitejs/plugin-react` | ^6.0 | React Fast Refresh |

---

## 🔌 API & WebSocket Config

| Constant | Value | File |
|---|---|---|
| REST base URL | `http://localhost:3001/api` | `src/api/announcements.js` |
| WebSocket URL | `ws://localhost:3001` | `src/hooks/useWebSocket.js` |

---

## 🧩 Component Details

### `AnnouncementsTable`
Renders the full filter bar (search input + react-select category multi-filter + "New Announcement" button), the TanStack Table, and a numeric pagination strip. Uses **manual pagination** — the parent (`AnnouncementsPage`) owns all data-fetching state.

### `EditAnnouncementPage`
Two-column layout:
- **Left** — form fields: Title, Content, Category (react-select multi), Publication Date (auto-formatted)
- **Right** — live preview panel using the same CSS classes as the real `NotificationToast`

Date validation enforces `MM/DD/YYYY HH:mm` format before calling the API. On success, navigates back to `/announcements`.

### `useWebSocket`
Module-level singleton pattern:
- `sharedWs` — a single `WebSocket` instance shared by all hook consumers
- `listeners` — a `Set` of message callbacks; mount/unmount only adds/removes a callback
- Auto-reconnects after 3 s if there are active listeners when the socket closes
- Safe against React StrictMode double-mount (no duplicate sockets)

### `NotificationToast`
Subscribes via `useWebSocket`. On `NEW_ANNOUNCEMENT`:
- Pushes a new toast `{ id, title, body }` into the local stack
- Auto-dismisses after **4 seconds**
- User can also close manually with the `×` button

---

## 🎨 Styling

All styles live in `src/index.css` as a single, well-organised vanilla CSS file. Key design tokens:

| Variable | Value |
|---|---|
| `--sidebar-width` | `200px` |
| Accent colour | `#f5a623` (amber) |
| Font | Lato (loaded via Google Fonts) |
| Background | `#f5f5f5` |

The design follows the provided Figma spec with a white sidebar, clean data table, amber category tags, and a fixed bottom-right toast stack.

# 🖥️ Frontend Structure

A React 19 SPA scaffolded with **Vite 8**. This document covers the component tree, routing, state management, custom hooks, and styling system.

---

## Directory Layout

```
src/
├── main.jsx                   # React root — mounts <App /> into #root
├── App.jsx                    # BrowserRouter + shell layout
├── index.css                  # Global design system
├── App.css                    # (minimal) app-level overrides
├── api/
│   └── announcements.js       # Axios CRUD client
├── hooks/
│   └── useWebSocket.js        # Singleton WS hook
├── components/
│   ├── AnnouncementsTable.jsx # Table + filter bar + pagination
│   ├── NotificationToast.jsx  # Real-time toast stack
│   ├── Sidebar.jsx            # Navigation sidebar
│   └── PortfolioPopup.jsx     # First-visit promo popup
└── pages/
    ├── AnnouncementsPage.jsx  # List page (data owner)
    └── EditAnnouncementPage.jsx # Create / Edit form + live preview
```

---

## Application Shell (`App.jsx`)

```
<BrowserRouter>
  <AppShell>
    <Sidebar />               ← persistent left navigation
    <main-content>
      <RouteBar />            ← dev-only route path indicator
      <Routes>
        /                     → redirect to /announcements
        /announcements        → <AnnouncementsPage />
        /announcements/:id    → <EditAnnouncementPage />
      </Routes>
    </main-content>
    <NotificationToast />     ← overlaid at bottom-right (fixed)
    <PortfolioPopup />        ← overlaid modal (first visit)
  </AppShell>
</BrowserRouter>
```

---

## Routing

| Path | Component | Notes |
|---|---|---|
| `/` | — | `<Navigate to="/announcements" replace />` |
| `/announcements` | `AnnouncementsPage` | List view |
| `/announcements/new` | `EditAnnouncementPage` | `id === "new"` → create mode |
| `/announcements/:id` | `EditAnnouncementPage` | `id` is a numeric string → edit mode |

---

## Pages

### `AnnouncementsPage`

**Responsibilities:** owns all data-fetching state; delegates rendering to `AnnouncementsTable`.

**State:**

| State | Type | Purpose |
|---|---|---|
| `data` | `Announcement[]` | Current page rows |
| `pagination` | `{total, page, limit, totalPages}` | Pagination metadata |
| `page` | `number` | Active page (resets to 1 on filter change) |
| `search` | `string` | Full-text search string |
| `categories` | `{value,label}[]` | Selected category filters |
| `loading` | `boolean` | Show skeleton / spinner |
| `error` | `string\|null` | Error message banner |

`fetchData` is memoised with `useCallback`. It re-runs when `page`, `search`, or `categories` change, **and** whenever `location.key` changes (React Router updates the key on every navigation, so returning from create/edit triggers a fresh fetch automatically).

---

### `EditAnnouncementPage`

**Responsibilities:** create or update a single announcement; render a live preview of the notification toast.

**Mode detection:**
```javascript
const { id } = useParams();
const isNew = id === 'new';
```

**State:**

| State | Purpose |
|---|---|
| `title` | Title field value |
| `body` | Content textarea value |
| `categories` | react-select `{value,label}[]` |
| `pubDate` | Formatted string `MM/DD/YYYY HH:mm` |
| `fieldErrors` | Per-field validation error messages |
| `submitting` | Disables the Publish button during the API call |
| `loadError` | Error banner shown when loading an existing record fails |

**Date input auto-formatting (`handlePubDateChange`):**

The input accepts only digits; slashes and the space/colon separators are inserted automatically:
```
1         → "1"
12        → "12"
123       → "12/3"
1231      → "12/31"
12312     → "12/31/2"
...
12312024  → "12/31/2024"
123120241 → "12/31/2024 1"
1231202410 → "12/31/2024 10"
12312024105 → "12/31/2024 10:5"
123120241055 → "12/31/2024 10:55"
```

The formatted string is capped at 16 characters (`MM/DD/YYYY HH:mm`).

**Live preview:**

The right panel uses the exact same CSS classes (`toast`, `toast-icon`, `toast-body`, `toast-close`) as `NotificationToast`. When all fields are empty, a bell-icon empty state is shown.

---

## Components

### `AnnouncementsTable`

Props received from `AnnouncementsPage` (controlled component — no internal state):

| Prop | Type | Description |
|---|---|---|
| `data` | `Announcement[]` | Rows to display |
| `pagination` | object | Pagination metadata |
| `page` | number | Current page |
| `onPageChange` | function | Callback to change page |
| `search` | string | Current search value |
| `onSearchChange` | function | Callback to update search |
| `categories` | option[] | Active category filters |
| `onCategoriesChange` | function | Callback to update filters |
| `onDeleted` | function | Refreshes the list after a delete |
| `loading` | boolean | Shows "Loading…" state |
| `error` | string\|null | Shows error banner |

**Table columns:**

| Column | Key | Notes |
|---|---|---|
| Title | `title` | Plain text |
| Publication date | `publication_date` | Formatted `MM/DD/YYYY HH:mm`; shows `⏰ Scheduled` badge if in the future |
| Last update | `last_update` | Formatted date |
| Categories | `categories` | Each value rendered as a `<span class="category-tag">` |
| Actions | — | Edit (pencil icon → navigate) + Delete (trash icon → confirm → API) |

Uses **TanStack Table v8** in `manualPagination` mode — all sorting, filtering, and pagination is server-side.

---

### `NotificationToast`

- Subscribes to `useWebSocket`
- On `NEW_ANNOUNCEMENT`: pushes `{ id, title, body }` onto the `toasts` state array
- Each toast auto-dismisses after **4 000 ms** via `setTimeout`
- User can dismiss early with the `×` button
- Renders inside a fixed `.toast-container` (bottom-right corner)

---

### `Sidebar`

Static navigation rail using `<NavLink>` from React Router. Adds class `active` to the link matching the current route. Currently only links to `/announcements`.

---

### `PortfolioPopup`

- Checks `sessionStorage` for a `portfolio_popup_dismissed` key
- If absent, shows a modal after a **900 ms** delay
- On dismiss: plays a fade-out animation (380 ms), then sets the storage key
- Clicking the backdrop also dismisses
- Links to `gas.green` and the author's GitHub profile

---

## Custom Hook: `useWebSocket`

**File:** `src/hooks/useWebSocket.js`

```javascript
useWebSocket(onMessage: (payload: { type: string, data: any }) => void): void
```

**Internals:**

```
Module scope:
  sharedWs      — WebSocket | null
  listeners     — Set<Function>
  reconnectTimer — timeout ID | null

ensureConnected():
  if sharedWs && readyState ≤ OPEN → return
  sharedWs = new WebSocket('ws://localhost:3001')
  sharedWs.onmessage → parse JSON → call all listeners
  sharedWs.onclose   → sharedWs = null; reconnect after 3s if listeners.size > 0
  sharedWs.onerror   → sharedWs.close()

useWebSocket(onMessage):
  stores onMessage in a ref (stable across renders)
  on mount:
    cb = (payload) => onMessageRef.current(payload)
    listeners.add(cb)
    ensureConnected()
  on unmount:
    listeners.delete(cb)
```

---

## API Client (`src/api/announcements.js`)

Thin Axios wrapper. All functions return promises of the parsed response data.

```javascript
getAnnouncements(params)          // GET /api/announcements
getAnnouncement(id)               // GET /api/announcements/:id
createAnnouncement(data)          // POST /api/announcements
updateAnnouncement(id, data)      // PUT /api/announcements/:id
deleteAnnouncement(id)            // DELETE /api/announcements/:id
```

---

## Styling System (`src/index.css`)

All styles are **vanilla CSS** — no framework. Key sections:

| Section | Description |
|---|---|
| Google Fonts import | Lato 400/700 |
| CSS reset & base | `box-sizing`, `body` defaults |
| Layout | `.app-shell`, `.sidebar`, `.main-content` |
| Sidebar | `.sidebar-header`, `.sidebar-nav`, `.sidebar-link` |
| Page | `.page-body`, `.page-title`, `.route-bar` |
| Filter bar | `.filter-bar`, `#search-input` |
| Table | `.table-card`, `.ann-table`, `.category-tag`, `.col-actions`, `.action-btn` |
| Pagination | `.pagination` |
| Form | `.edit-layout`, `.form-card`, `.form-group`, `.form-input`, `.form-textarea`, `.form-actions`, `.btn-publish`, `.btn-cancel` |
| Preview panel | `.preview-panel`, `.preview-stage`, `.preview-toast`, `.preview-empty-state`, `.preview-hint` |
| Toast | `.toast-container`, `.toast`, `.toast-icon`, `.toast-body`, `.toast-close` |
| Portfolio popup | `.pp-backdrop`, `.pp-box`, `.pp-topbar`, `.pp-body`, `.pp-links`, `.pp-github`, `.pp-close` |

**Design tokens (hard-coded values):**

| Token | Value |
|---|---|
| Sidebar width | `200px` |
| Accent / amber | `#f5a623` |
| Danger / red | `#e53935` |
| Background | `#f5f5f5` |
| Card background | `#ffffff` |
| Font | `Lato, sans-serif` |

---

## See Also

- [Architecture Overview](../architecture/overview.md)
- [REST API Reference](../api/rest.md)
- [WebSocket Protocol](../api/websocket.md)

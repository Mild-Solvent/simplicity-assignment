import { Link, useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import Select from 'react-select';
import { deleteAnnouncement } from '../api/announcements';

const CATEGORY_OPTIONS = [
  'City',
  'Community events',
  'Crime & Safety',
  'Culture',
  'Discounts & Benefits',
  'Emergencies',
  'For Seniors',
  'Health',
  'Kids & Family',
].map((c) => ({ value: c, label: c }));

/** Format ISO string → MM/DD/YYYY HH:mm */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
}

export default function AnnouncementsTable({
  data,
  pagination,
  page,
  onPageChange,
  search,
  onSearchChange,
  categories,
  onCategoriesChange,
  onDeleted,
  loading,
  error,
}) {
  const navigate = useNavigate();

  async function handleDelete(id, title) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteAnnouncement(id);
      onDeleted?.();
    } catch {
      alert('Failed to delete the announcement. Please try again.');
    }
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: (info) => info.getValue(),
      },
      {
        accessorKey: 'publication_date',
        header: 'Publication date',
        cell: (info) => formatDate(info.getValue()),
      },
      {
        accessorKey: 'last_update',
        header: 'Last update',
        cell: (info) => formatDate(info.getValue()),
      },
      {
        accessorKey: 'categories',
        header: 'Categories',
        cell: (info) => (
          <span>
            {(info.getValue() || []).map((c) => (
              <span key={c} className="category-tag">{c}</span>
            ))}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
            {/* Edit */}
            <button
              className="action-btn"
              title="Edit announcement"
              onClick={() => navigate(`/announcements/${row.original.id}`)}
            >
              {/* Pencil icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            {/* Delete */}
            <button
              className="action-btn delete"
              title="Delete announcement"
              onClick={() => handleDelete(row.original.id, row.original.title)}
            >
              {/* Trash icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        ),
      },
    ],
    [navigate]
  );

  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pagination?.totalPages ?? 1,
  });

  // ─── Pagination pages ──────────────────────────────────────────────────────
  const totalPages = pagination?.totalPages ?? 1;
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);

  return (
    <>
      {/* ─── Filter Bar ──────────────────────────────────────────────────── */}
      <div className="filter-bar">
        <input
          id="search-input"
          type="text"
          placeholder="Search announcements…"
          value={search}
          onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
        />

        <div style={{ minWidth: 260, flex: '0 0 auto' }}>
          <Select
            inputId="category-filter"
            isMulti
            options={CATEGORY_OPTIONS}
            value={categories}
            onChange={(selected) => { onCategoriesChange(selected || []); onPageChange(1); }}
            placeholder="Filter by category…"
            classNamePrefix="rs"
            styles={{
              control: (base, state) => ({
                ...base,
                borderColor: state.isFocused ? '#f5a623' : '#ddd',
                boxShadow: state.isFocused ? '0 0 0 3px rgba(245,166,35,0.12)' : 'none',
                fontFamily: 'Lato, sans-serif',
                fontSize: 13,
                minHeight: 36,
                '&:hover': { borderColor: '#f5a623' },
              }),
              multiValue: (base) => ({ ...base, background: '#f0f0f0', borderRadius: 10 }),
              option: (base, state) => ({
                ...base,
                fontSize: 13,
                background: state.isSelected ? '#f5a623' : state.isFocused ? '#fff9c4' : 'white',
                color: state.isSelected ? '#fff' : '#333',
              }),
              placeholder: (base) => ({ ...base, color: '#aaa', fontSize: 13 }),
            }}
          />
        </div>

        <Link to="/announcements/new" className="btn-new" id="btn-new-announcement">
          + New Announcement
        </Link>
      </div>

      {/* ─── Error ───────────────────────────────────────────────────────── */}
      {error && <div className="error-banner">{error}</div>}

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      <div className="table-card">
        {loading ? (
          <div className="state-message">Loading…</div>
        ) : data?.length === 0 ? (
          <div className="state-message">No announcements found.</div>
        ) : (
          <table className="ann-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className={h.id === 'actions' ? 'col-actions' : ''}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cell.column.id === 'actions' ? 'col-actions' : ''}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ─── Pagination ──────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹ Prev</button>

            {pageNumbers.map((n) => (
              <button
                key={n}
                className={n === page ? 'active' : ''}
                onClick={() => onPageChange(n)}
              >
                {n}
              </button>
            ))}

            <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>Next ›</button>

            <span style={{ marginLeft: 8 }}>
              Page {page} of {totalPages} &nbsp;·&nbsp; {pagination?.total ?? 0} total
            </span>
          </div>
        )}
      </div>
    </>
  );
}

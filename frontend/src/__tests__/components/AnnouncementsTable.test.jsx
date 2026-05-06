import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import AnnouncementsTable from '../../components/AnnouncementsTable';
import { deleteAnnouncement } from '../../api/announcements';

vi.mock('../../api/announcements', () => ({
  deleteAnnouncement: vi.fn(),
}));

// react-select is complex in jsdom; replace with a plain input so we can test category logic
vi.mock('react-select', () => ({
  default: ({ onChange, placeholder, inputId, value }) => (
    <input
      data-testid="category-select"
      id={inputId}
      placeholder={placeholder}
      value={value?.map((v) => v.value).join(',') ?? ''}
      onChange={(e) => {
        const vals = e.target.value
          ? e.target.value.split(',').map((v) => ({ value: v, label: v }))
          : [];
        onChange(vals);
      }}
    />
  ),
}));

const SAMPLE_DATA = [
  {
    id: 1,
    title: 'Road Closure',
    body: 'Downtown closed',
    publication_date: '2023-08-11T04:38:00.000Z',
    last_update: '2023-08-11T04:38:00.000Z',
    categories: ['City'],
  },
  {
    id: 2,
    title: 'Health Screening',
    body: 'Free checkup',
    publication_date: '2023-03-24T07:27:00.000Z',
    last_update: '2023-03-24T07:27:00.000Z',
    categories: ['Health'],
  },
];

const SAMPLE_PAGINATION = { total: 2, page: 1, limit: 10, totalPages: 1 };

function renderTable(overrides = {}) {
  const defaults = {
    data: SAMPLE_DATA,
    pagination: SAMPLE_PAGINATION,
    page: 1,
    onPageChange: vi.fn(),
    search: '',
    onSearchChange: vi.fn(),
    categories: [],
    onCategoriesChange: vi.fn(),
    onDeleted: vi.fn(),
    loading: false,
    error: null,
  };
  return render(
    <MemoryRouter>
      <AnnouncementsTable {...defaults} {...overrides} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('AnnouncementsTable', () => {
  describe('loading and error states', () => {
    test('shows loading indicator when loading=true', () => {
      renderTable({ loading: true });
      expect(screen.getByText('Loading…')).toBeInTheDocument();
      expect(screen.queryByRole('table')).toBeNull();
    });

    test('shows empty state message when data is empty', () => {
      renderTable({ data: [], pagination: { ...SAMPLE_PAGINATION, total: 0, totalPages: 0 } });
      expect(screen.getByText('No announcements found.')).toBeInTheDocument();
    });

    test('shows error banner when error is set', () => {
      renderTable({ error: 'Failed to fetch' });
      expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    });
  });

  describe('table rendering', () => {
    test('renders a row for each announcement', () => {
      renderTable();
      expect(screen.getByText('Road Closure')).toBeInTheDocument();
      expect(screen.getByText('Health Screening')).toBeInTheDocument();
    });

    test('renders category tags for each announcement', () => {
      renderTable();
      expect(screen.getByText('City')).toBeInTheDocument();
      expect(screen.getByText('Health')).toBeInTheDocument();
    });

    test('shows "Scheduled" badge for future publication dates', () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const data = [{ ...SAMPLE_DATA[0], publication_date: future }];
      renderTable({ data });
      expect(screen.getByText(/Scheduled/i)).toBeInTheDocument();
    });

    test('does not show "Scheduled" badge for past publication dates', () => {
      renderTable({ data: SAMPLE_DATA }); // all dates are in 2023
      expect(screen.queryByText(/Scheduled/i)).toBeNull();
    });

    test('renders column headers', () => {
      renderTable();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Publication date')).toBeInTheDocument();
      expect(screen.getByText('Last update')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });
  });

  describe('search input', () => {
    test('renders search input with current value', () => {
      renderTable({ search: 'road' });
      expect(screen.getByPlaceholderText('Search announcements…')).toHaveValue('road');
    });

    test('calls onSearchChange and resets page when user types', async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();
      const onPageChange = vi.fn();
      renderTable({ onSearchChange, onPageChange });

      await user.type(screen.getByPlaceholderText('Search announcements…'), 'park');

      expect(onSearchChange).toHaveBeenCalled();
      expect(onPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe('pagination', () => {
    test('hides pagination when totalPages <= 1', () => {
      renderTable(); // SAMPLE_PAGINATION has totalPages: 1
      expect(screen.queryByText('‹ Prev')).toBeNull();
    });

    test('shows pagination controls when totalPages > 1', () => {
      renderTable({ pagination: { total: 25, page: 1, limit: 10, totalPages: 3 }, page: 1 });
      expect(screen.getByText('‹ Prev')).toBeInTheDocument();
      expect(screen.getByText('Next ›')).toBeInTheDocument();
    });

    test('prev button is disabled on first page', () => {
      renderTable({ pagination: { total: 25, page: 1, limit: 10, totalPages: 3 }, page: 1 });
      expect(screen.getByText('‹ Prev')).toBeDisabled();
    });

    test('next button is disabled on last page', () => {
      renderTable({ pagination: { total: 25, page: 3, limit: 10, totalPages: 3 }, page: 3 });
      expect(screen.getByText('Next ›')).toBeDisabled();
    });

    test('calls onPageChange when a page button is clicked', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      renderTable({
        pagination: { total: 25, page: 1, limit: 10, totalPages: 3 },
        page: 1,
        onPageChange,
      });

      await user.click(screen.getByText('2'));

      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('delete flow', () => {
    test('calls deleteAnnouncement and onDeleted after confirm', async () => {
      const user = userEvent.setup();
      const onDeleted = vi.fn();
      deleteAnnouncement.mockResolvedValue();
      renderTable({ onDeleted });

      const deleteButtons = document.querySelectorAll('.action-btn.delete');
      await user.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith('Delete "Road Closure"? This cannot be undone.');
      expect(deleteAnnouncement).toHaveBeenCalledWith(1);
      await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
    });

    test('does not call deleteAnnouncement when confirm is cancelled', async () => {
      const user = userEvent.setup();
      window.confirm.mockReturnValue(false);
      renderTable();

      const deleteButtons = document.querySelectorAll('.action-btn.delete');
      await user.click(deleteButtons[0]);

      expect(deleteAnnouncement).not.toHaveBeenCalled();
    });

    test('shows alert when deleteAnnouncement throws', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      deleteAnnouncement.mockRejectedValue(new Error('Network error'));
      renderTable();

      const deleteButtons = document.querySelectorAll('.action-btn.delete');
      await user.click(deleteButtons[0]);

      await vi.waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          'Failed to delete the announcement. Please try again.'
        )
      );
    });
  });
});

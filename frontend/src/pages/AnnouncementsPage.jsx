import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import AnnouncementsTable from '../components/AnnouncementsTable';
import { getAnnouncements } from '../api/announcements';

export default function AnnouncementsPage() {
  const location = useLocation();

  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass selected category values as a comma-separated string
      const categoryParam = categories.map((c) => c.value).join(',');
      const result = await getAnnouncements({
        page,
        limit: 10,
        ...(search ? { search } : {}),
        ...(categoryParam ? { category: categoryParam } : {}),
      });
      setData(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError('Failed to load announcements. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [page, search, categories]);

  // Refetch when navigating back to this page (e.g. after create/edit)
  useEffect(() => {
    fetchData();
  }, [fetchData, location.key]);

  return (
    <div className="page-body">
      <h1 className="page-title">Announcements</h1>

      <AnnouncementsTable
        data={data}
        pagination={pagination}
        page={page}
        onPageChange={setPage}
        search={search}
        onSearchChange={setSearch}
        categories={categories}
        onCategoriesChange={setCategories}
        onDeleted={fetchData}
        loading={loading}
        error={error}
      />
    </div>
  );
}

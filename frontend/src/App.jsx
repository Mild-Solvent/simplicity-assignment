import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import NotificationToast from './components/NotificationToast';
import AnnouncementsPage from './pages/AnnouncementsPage';
import EditAnnouncementPage from './pages/EditAnnouncementPage';

function RouteBar() {
  const location = useLocation();
  return <div className="route-bar">Route: {location.pathname}</div>;
}

function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <RouteBar />
        <Routes>
          <Route path="/" element={<Navigate to="/announcements" replace />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/announcements/:id" element={<EditAnnouncementPage />} />
        </Routes>
      </div>
      <NotificationToast />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

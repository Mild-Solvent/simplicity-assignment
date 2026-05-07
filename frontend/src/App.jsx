import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import NotificationToast from './components/NotificationToast';
import PortfolioPopup from './components/PortfolioPopup';
import AnnouncementsPage from './pages/AnnouncementsPage';
import EditAnnouncementPage from './pages/EditAnnouncementPage';

function RouteBar({ onHamburger }) {
  const location = useLocation();
  return (
    <div className="route-bar">
      <button
        className="hamburger"
        onClick={onHamburger}
        aria-label="Open navigation menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="3" y1="6"  x2="21" y2="6"  />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      Route: {location.pathname}
    </div>
  );
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const open  = useCallback(() => setSidebarOpen(true),  []);
  const close = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="app-shell">
      {/* Overlay — only visible on mobile when sidebar is open */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={close} aria-hidden="true" />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={close} />
      <div className="main-content">
        <RouteBar onHamburger={open} />
        <Routes>
          <Route path="/" element={<Navigate to="/announcements" replace />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/announcements/:id" element={<EditAnnouncementPage />} />
        </Routes>
      </div>
      <NotificationToast />
      <PortfolioPopup />
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

import { NavLink } from 'react-router-dom';

export default function Sidebar({ isOpen, onClose }) {
  return (
    <aside
      className={`sidebar${isOpen ? ' sidebar-open' : ''}`}
      aria-hidden={!isOpen ? 'true' : undefined}
    >
      <div className="sidebar-header">
        <span className="sidebar-header-icon">🏙</span>
        Test city
        {/* Close button — only visible on mobile */}
        <button className="sidebar-close" onClick={onClose} aria-label="Close navigation menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/announcements"
          className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          onClick={onClose}
        >
          {/* Bell icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Announcements
        </NavLink>
      </nav>
    </aside>
  );
}

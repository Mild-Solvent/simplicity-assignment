import { NavLink, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-header-icon">🏙</span>
        Test city
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/announcements"
          className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
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

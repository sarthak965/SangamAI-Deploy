import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { CurrentUser } from "../types";
import { useTheme } from "../lib/theme";

export default function AppShell({
  me,
  onLogout,
  children,
}: {
  me: CurrentUser;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const toggleSidebar = () => {
    if (window.innerWidth <= 1024) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="app-layout">
      {/* mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? "visible" : ""}`}
        onClick={closeMobile}
      />

      {/* toggle button */}
      <button
        className={`sidebar-toggle ${collapsed || window.innerWidth <= 1024 ? "visible" : ""}`}
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      {/* sidebar */}
      <aside
        className={`sidebar ${collapsed && !mobileOpen ? "collapsed" : ""} ${mobileOpen ? "open" : ""}`}
      >
        <div className="sidebar-brand">
          <div className="logo-icon">S</div>
          <span>SangamAI</span>
        </div>

        <div className="sidebar-user">
          <div className="user-name">{me.displayName}</div>
          <div className="user-handle">@{me.username}</div>
        </div>

        <nav className="sidebar-menu">
          <NavLink
            to="/app/profile"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            onClick={closeMobile}
          >
            <span className="link-icon">👤</span>
            My Profile
          </NavLink>
          <NavLink
            to="/app/environments"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            onClick={closeMobile}
          >
            <span className="link-icon">🏠</span>
            Environments
          </NavLink>
          <NavLink
            to="/app/friends"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            onClick={closeMobile}
          >
            <span className="link-icon">👥</span>
            Friends
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          {/* Dark mode toggle */}
          <button className="theme-toggle" onClick={toggleTheme} type="button">
            <span className="link-icon">{theme === "dark" ? "🌙" : "☀️"}</span>
            {theme === "dark" ? "Dark Mode" : "Light Mode"}
            <div className={`toggle-track ${theme === "dark" ? "active" : ""}`} />
          </button>

          <button
            className="btn"
            onClick={() => {
              closeMobile();
              onLogout();
            }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* main content */}
      <main className={`app-main ${collapsed ? "expanded" : ""}`}>
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}

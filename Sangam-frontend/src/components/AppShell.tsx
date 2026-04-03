import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { CurrentUser, ProjectResponse, SoloChatSummaryResponse } from "../types";
import { api } from "../lib/api";
import ChatOverflowMenu from "./ChatOverflowMenu";

export default function AppShell({
  token,
  me,
  onWorkspaceChanged,
  recentChats,
  children,
}: {
  token: string;
  me: CurrentUser;
  onWorkspaceChanged: () => Promise<void>;
  recentChats: SoloChatSummaryResponse[];
  children: ReactNode;
}) {
  const DESKTOP_COLLAPSED_WIDTH = 0;
  const DEFAULT_SIDEBAR_WIDTH = 272;
  const MIN_SIDEBAR_WIDTH = 248;
  const MAX_SIDEBAR_WIDTH = 380;
  const COLLAPSE_DRAG_THRESHOLD = 140;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 1024,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const showSidebar = isMobile ? mobileOpen : !collapsed;
  const [projects, setProjects] = useState<ProjectResponse[]>([]);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => {
      const nextCollapsed = !prev;
      if (!nextCollapsed && sidebarWidth < MIN_SIDEBAR_WIDTH) {
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
      }
      return nextCollapsed;
    });
  };

  const closeMobile = () => setMobileOpen(false);

  const handleSidebarResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isMobile || collapsed) return;
    event.preventDefault();
    dragStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    setIsDraggingSidebar(true);
  };

  useEffect(() => {
    closeMobile();
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewportMode = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) {
        setMobileOpen(false);
      }
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, []);

  useEffect(() => {
    api.listProjects(token).then(setProjects).catch(() => setProjects([]));
  }, [token, recentChats]);

  useEffect(() => {
    if (!isDraggingSidebar) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current) return;
      const nextWidth = dragStateRef.current.startWidth + (event.clientX - dragStateRef.current.startX);
      if (nextWidth <= COLLAPSE_DRAG_THRESHOLD) {
        setSidebarWidth(0);
        return;
      }

      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, nextWidth)));
    };

    const stopDragging = () => {
      if (sidebarWidth <= COLLAPSE_DRAG_THRESHOLD) {
        setCollapsed(true);
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
      }
      dragStateRef.current = null;
      setIsDraggingSidebar(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDraggingSidebar, sidebarWidth]);

  const layoutStyle = {
    "--workspace-sidebar-width": !isMobile ? `${sidebarWidth}px` : `${DEFAULT_SIDEBAR_WIDTH}px`,
    "--workspace-main-offset":
      !isMobile && showSidebar ? `${sidebarWidth}px` : `${DESKTOP_COLLAPSED_WIDTH}px`,
  } as CSSProperties;

  return (
    <div className={`workspace-layout ${isDraggingSidebar ? "resizing" : ""}`} style={layoutStyle}>
      <div
        className={`workspace-overlay ${mobileOpen ? "visible" : ""}`}
        onClick={closeMobile}
      />

      <button
        className={`workspace-sidebar-edge-toggle ${showSidebar ? "open" : "collapsed"} ${isMobile ? "mobile" : ""}`}
        onClick={toggleSidebar}
        aria-label={showSidebar ? "Collapse sidebar" : "Expand sidebar"}
        type="button"
      >
        <SidebarToggleIcon collapsed={!showSidebar} />
      </button>

      <aside className={`workspace-sidebar ${showSidebar ? "open" : "collapsed"}`}>
        <div className="workspace-sidebar-head">
          <div className="workspace-brand">
            <div className="logo-icon">S</div>
            <div>
              <strong>SangamAI</strong>
              <span>Personal workspace</span>
            </div>
          </div>
        </div>

        <div className="workspace-sidebar-scroll">
          <button
            className="workspace-primary-action"
            type="button"
            onClick={() => navigate("/app")}
          >
            <span className="workspace-icon-pill">+</span>
            New Chat
          </button>

          <nav className="workspace-nav">
            <NavLink
              to="/app/projects"
              className={({ isActive }) => `workspace-nav-link ${isActive ? "active" : ""}`}
            >
              <span className="workspace-nav-icon">◇</span>
              <span>Projects</span>
            </NavLink>
            <NavLink
              to="/app/history"
              className={({ isActive }) => `workspace-nav-link ${isActive ? "active" : ""}`}
            >
              <span className="workspace-nav-icon">⌕</span>
              <span>History</span>
            </NavLink>
            <NavLink
              to="/app/friends"
              className={({ isActive }) => `workspace-nav-link ${isActive ? "active" : ""}`}
            >
              <span className="workspace-nav-icon">@</span>
              <span>Friends</span>
            </NavLink>
            <NavLink
              to="/app/environments"
              className={({ isActive }) => `workspace-nav-link ${isActive ? "active" : ""}`}
            >
              <span className="workspace-nav-icon">▭</span>
              <span>Environments</span>
            </NavLink>
          </nav>

          <div className="workspace-recent-section">
            <div className="workspace-section-label">Recent</div>
            <div className="workspace-recent-list">
              {recentChats.length === 0 ? (
                <div className="workspace-recent-empty">
                  Personal chat history will appear here.
                </div>
              ) : (
                recentChats.map((chat) => (
                  <div key={chat.id} className="workspace-recent-row">
                    <button
                      className="workspace-recent-item"
                      type="button"
                      onClick={() => navigate(`/app/chats/${chat.id}`)}
                    >
                      <span className="workspace-recent-title">
                        {chat.pinned && <span className="workspace-recent-pin">📌</span>}
                        {chat.title}
                      </span>
                    </button>
                    <ChatOverflowMenu
                      token={token}
                      chat={chat}
                      projects={projects}
                      onChanged={onWorkspaceChanged}
                      onDeleted={(deletedId) => {
                        if (location.pathname.endsWith(deletedId)) {
                          navigate("/app/history");
                        }
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="workspace-sidebar-foot">
          <NavLink
            to="/app/profile"
            className={({ isActive }) => `workspace-profile-chip ${isActive ? "active" : ""}`}
          >
            <div className="workspace-profile-avatar">
              {me.hasAvatar ? (
                <img
                  src={api.getUserAvatarUrl(me.id, me.updatedAt)}
                  alt={`${me.displayName} avatar`}
                  className="workspace-profile-avatar-image"
                />
              ) : (
                me.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="workspace-profile-copy">
              <strong>{me.displayName}</strong>
              <span>{me.email}</span>
            </div>
          </NavLink>
        </div>

        {!isMobile && showSidebar ? (
          <button
            className="workspace-sidebar-resizer"
            type="button"
            aria-label="Resize sidebar"
            onPointerDown={handleSidebarResizeStart}
          />
        ) : null}
      </aside>

      <main className={`workspace-main ${showSidebar ? "" : "expanded"}`}>
        <div className="app-content">
          <div key={location.pathname} className="route-transition">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.25" y="4" width="13.5" height="12" rx="2.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.65v10.7" stroke="currentColor" strokeWidth="1.3" />
      <path
        d={collapsed ? "M11 10h3M12.7 8.3 14.4 10l-1.7 1.7" : "M14 10h-3M12.3 8.3 10.6 10l1.7 1.7"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

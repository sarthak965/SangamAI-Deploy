import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import FriendsPage from "./pages/FriendsPage";
import EnvironmentsPage from "./pages/EnvironmentsPage";
import EnvironmentPage from "./pages/EnvironmentPage";
import SessionPage from "./pages/SessionPage";
import AppShell from "./components/AppShell";
import { api } from "./lib/api";
import { realtimeManager } from "./lib/realtime";
import type { AuthResponse, CurrentUser } from "./types";
import HomePage, { type SoloRecentChat } from "./pages/HomePage";
import ProjectsPage from "./pages/ProjectsPage";

const TOKEN_STORAGE_KEY = "sangam-auth-token";
const SOLO_RECENT_STORAGE_KEY = "sangam-solo-recent";
const MAX_SOLO_RECENTS = 8;

function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_STORAGE_KEY) ?? null,
  );
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [authError, setAuthError] = useState<string | null>(null);
  const [soloRecentChats, setSoloRecentChats] = useState<SoloRecentChat[]>(() => {
    try {
      const stored = localStorage.getItem(SOLO_RECENT_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!token) {
      setMe(null);
      setAuthLoading(false);
      return;
    }

    let active = true;
    setAuthLoading(true);

    api
      .getMe(token)
      .then((user) => {
        if (!active) return;
        setMe(user);
        setAuthError(null);
      })
      .catch((error: Error) => {
        if (!active) return;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        realtimeManager.disconnect();
        setToken(null);
        setMe(null);
        setAuthError(error.message);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleAuthenticated = (auth: AuthResponse) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, auth.token);
    setToken(auth.token);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    realtimeManager.disconnect();
    setToken(null);
    setMe(null);
  };

  const handleCreateSoloRecent = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const nextItem: SoloRecentChat = {
      id: crypto.randomUUID(),
      title: trimmed.length > 42 ? `${trimmed.slice(0, 42)}...` : trimmed,
      preview: trimmed.length > 84 ? `${trimmed.slice(0, 84)}...` : trimmed,
      updatedAt: new Date().toISOString(),
    };

    setSoloRecentChats((current) => {
      const next = [nextItem, ...current].slice(0, MAX_SOLO_RECENTS);
      localStorage.setItem(SOLO_RECENT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            currentUser={me}
            authLoading={authLoading}
            authError={authError}
            onAuthenticated={handleAuthenticated}
          />
        }
      />
      <Route
        path="/auth"
        element={
          <AuthPage
            currentUser={me}
            authLoading={authLoading}
            authError={authError}
            onAuthenticated={handleAuthenticated}
          />
        }
      />

      <Route
        path="/app/*"
        element={
          token && me ? (
            <AppShell me={me} onLogout={handleLogout} recentChats={soloRecentChats}>
              <Routes>
                <Route
                  index
                  element={
                    <HomePage
                      me={me}
                      recentChats={soloRecentChats}
                      onCreateRecent={handleCreateSoloRecent}
                    />
                  }
                />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="profile" element={<ProfilePage me={me} />} />
                <Route path="friends" element={<FriendsPage />} />
                <Route path="environments" element={<EnvironmentsPage token={token} />} />
                <Route
                  path="environments/:environmentId"
                  element={<EnvironmentPage token={token} me={me} />}
                />
                <Route
                  path="environments/:environmentId/sessions/:sessionId"
                  element={<SessionPage token={token} me={me} />}
                />
              </Routes>
            </AppShell>
          ) : authLoading ? (
            <div className="loading-screen">
              <div className="spinner" />
              <p>Restoring your workspace...</p>
            </div>
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;

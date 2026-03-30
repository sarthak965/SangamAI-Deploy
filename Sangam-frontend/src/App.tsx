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

const TOKEN_STORAGE_KEY = "sangam-auth-token";

function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_STORAGE_KEY) ?? null,
  );
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [authError, setAuthError] = useState<string | null>(null);

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

  return (
    <Routes>
      {/* Public routes */}
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

      {/* Protected routes */}
      <Route
        path="/app/*"
        element={
          token && me ? (
            <AppShell me={me} onLogout={handleLogout}>
              <Routes>
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<ProfilePage me={me} />} />
                <Route path="friends" element={<FriendsPage />} />
                <Route
                  path="environments"
                  element={<EnvironmentsPage token={token} />}
                />
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

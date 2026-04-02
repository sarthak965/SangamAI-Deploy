import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./lib/api";
import Starfield from "./components/Starfield";
import { realtimeManager } from "./lib/realtime";
import { applyThemePreference } from "./lib/theme";
import type { AuthResponse, CurrentUser } from "./types";
import type { SoloChatSummaryResponse } from "./types";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const FriendProfilePage = lazy(() => import("./pages/FriendProfilePage"));
const EnvironmentsPage = lazy(() => import("./pages/EnvironmentsPage"));
const EnvironmentPage = lazy(() => import("./pages/EnvironmentPage"));
const SessionPage = lazy(() => import("./pages/SessionPage"));
const AppShell = lazy(() => import("./components/AppShell"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const WorkspaceChatPage = lazy(() => import("./pages/WorkspaceChatPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));

const TOKEN_STORAGE_KEY = "sangam-auth-token";

function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_STORAGE_KEY) ?? null,
  );
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [authError, setAuthError] = useState<string | null>(null);
  const [soloRecentChats, setSoloRecentChats] = useState<SoloChatSummaryResponse[]>([]);

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
    setSoloRecentChats([]);
  };

  const refreshWorkspaceData = async () => {
    if (!token) return;
    const recents = await api.listRecentSoloChats(token, 10);
    setSoloRecentChats(recents);
  };

  useEffect(() => {
    if (!token || !me) return;
    refreshWorkspaceData().catch(() => {
      setSoloRecentChats([]);
    });
  }, [token, me]);

  useEffect(() => {
    if (!me) return;
    applyThemePreference(me.appearancePreference.toLowerCase() as "light" | "dark" | "system");
  }, [me]);

  return (
    <Suspense fallback={<RouteLoadingScreen />}>
      <Starfield enableTrail />
      <Routes>
        <Route
          path="/"
          element={
            <PageTransition>
              <LandingPage
                currentUser={me}
                authLoading={authLoading}
                authError={authError}
                onAuthenticated={handleAuthenticated}
              />
            </PageTransition>
          }
        />
        <Route
          path="/auth"
          element={
            <PageTransition>
              <AuthPage
                currentUser={me}
                authLoading={authLoading}
                authError={authError}
                onAuthenticated={handleAuthenticated}
              />
            </PageTransition>
          }
        />

        <Route
          path="/app/*"
          element={
            token && me ? (
              <AppShell
                token={token}
                me={me}
                onWorkspaceChanged={refreshWorkspaceData}
                recentChats={soloRecentChats}
              >
                <Routes>
                  <Route
                    index
                    element={
                      <HomePage
                        token={token}
                        me={me}
                        recentChats={soloRecentChats}
                        onWorkspaceChanged={refreshWorkspaceData}
                      />
                    }
                  />
                  <Route
                    path="projects"
                    element={
                      <ProjectsPage
                        token={token}
                        onWorkspaceChanged={refreshWorkspaceData}
                      />
                    }
                  />
                  <Route
                    path="chats/:chatId"
                    element={
                      <WorkspaceChatPage
                        token={token}
                        onWorkspaceChanged={refreshWorkspaceData}
                      />
                    }
                  />
                  <Route
                    path="projects/:projectId/chats/:chatId"
                    element={
                      <WorkspaceChatPage
                        token={token}
                        onWorkspaceChanged={refreshWorkspaceData}
                      />
                    }
                  />
                  <Route
                    path="history"
                    element={
                      <HistoryPage
                        token={token}
                        onWorkspaceChanged={refreshWorkspaceData}
                      />
                    }
                  />
                  <Route
                    path="profile"
                    element={
                      <ProfilePage
                        token={token}
                        me={me}
                        onLogout={handleLogout}
                        onProfileUpdated={(user, nextToken) => {
                          setMe(user);
                          if (nextToken) {
                            localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
                            setToken(nextToken);
                          }
                        }}
                      />
                    }
                  />
                  <Route path="friends" element={<FriendsPage token={token} me={me} />} />
                  <Route
                    path="friends/:username"
                    element={<FriendProfilePage token={token} me={me} />}
                  />
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
    </Suspense>
  );
}

export default App;

function RouteLoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="route-transition">
      {children}
    </div>
  );
}

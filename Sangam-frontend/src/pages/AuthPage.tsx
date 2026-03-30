import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import type { AuthResponse, CurrentUser } from "../types";

export default function AuthPage({
  currentUser,
  authLoading,
  authError,
  onAuthenticated,
}: {
  currentUser: CurrentUser | null;
  authLoading: boolean;
  authError: string | null;
  onAuthenticated: (auth: AuthResponse) => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) navigate("/app", { replace: true });
  }, [currentUser, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const auth =
        mode === "login"
          ? await api.login({ email: form.email, password: form.password })
          : await api.register({
              username: form.username,
              displayName: form.displayName,
              email: form.email,
              password: form.password,
            });

      onAuthenticated(auth);
      navigate("/app");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const { theme, toggle: toggleTheme } = useTheme();
  const displayError = formError ?? authError;

  return (
    <div className="auth-page">
      {/* Theme toggle in top-right corner */}
      <button
        className="btn btn-ghost"
        onClick={toggleTheme}
        type="button"
        style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 10 }}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "🌙" : "☀️"}
      </button>

      <div className="auth-container">
        <div className="auth-header">
          <div className="logo-icon">S</div>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>
            {mode === "login"
              ? "Sign in to continue to SangamAI"
              : "Join SangamAI and start collaborating"}
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    value={form.username}
                    onChange={(e) => updateField("username", e.target.value)}
                    placeholder="priya"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Display name</label>
                  <input
                    value={form.displayName}
                    onChange={(e) => updateField("displayName", e.target.value)}
                    placeholder="Priya N."
                    required
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="team@sangam.ai"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {displayError && <div className="auth-error">{displayError}</div>}

            <button
              className="btn btn-primary"
              disabled={submitting || authLoading}
              type="submit"
            >
              {submitting
                ? "Connecting..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>
        </div>

        <div className="auth-footer">
          {mode === "login" ? (
            <p>
              Don't have an account?{" "}
              <a onClick={() => setMode("register")}>Sign up</a>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <a onClick={() => setMode("login")}>Sign in</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

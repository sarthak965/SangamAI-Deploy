import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useForcedTheme } from "../lib/theme";
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
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; clientId: string }>({
    enabled: false,
    clientId: "",
  });

  useForcedTheme("dark");

  useEffect(() => {
    if (currentUser) navigate("/app", { replace: true });
  }, [currentUser, navigate]);

  useEffect(() => {
    let cancelled = false;

    api
      .getGoogleAuthConfig()
      .then((config) => {
        if (!cancelled) {
          setGoogleConfig(config);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleConfig({ enabled: false, clientId: "" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const googleEnabled = googleConfig.enabled && Boolean(googleConfig.clientId);

  const displayError = formError ?? authError;

  useEffect(() => {
    if (!googleEnabled || !googleButtonRef.current) {
      return;
    }

    const scriptId = "google-identity-services";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleConfig.clientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setFormError("Google authentication failed");
            return;
          }

          setSubmitting(true);
          setFormError(null);
          try {
            const auth = await api.googleLogin({ credential });
            onAuthenticated(auth);
            navigate("/app");
          } catch (err) {
            setFormError(err instanceof Error ? err.message : "Google authentication failed");
          } finally {
            setSubmitting(false);
          }
        },
        ux_mode: "popup",
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: mode === "login" ? "signin_with" : "signup_with",
        shape: "pill",
        width: 360,
        logo_alignment: "left",
      });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const script = existingScript ?? document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;

    if (!existingScript) {
      document.head.appendChild(script);
    }
  }, [googleConfig.clientId, googleEnabled, mode, navigate, onAuthenticated]);

  return (
    <div className="auth-page">
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

          <>
            <div className="auth-divider">
              <span>or continue with</span>
            </div>
            <div className="auth-google-wrap">
              {googleEnabled ? (
                <div ref={googleButtonRef} className="auth-google-button" />
              ) : (
                <button
                  className="auth-google-fallback"
                  type="button"
                  onClick={() =>
                    setFormError(
                      "Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID in the backend and restart the server.",
                    )
                  }
                >
                  <span className="auth-google-fallback-icon">G</span>
                  <span>
                    {mode === "login" ? "Continue with Google" : "Sign up with Google"}
                  </span>
                </button>
              )}
            </div>
          </>
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



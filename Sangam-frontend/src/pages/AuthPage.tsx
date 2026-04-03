import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useForcedTheme } from "../lib/theme";
import type { AuthResponse, CurrentUser } from "../types";

type AuthMode = "login" | "register" | "forgot-password";
type ResetStep = "request" | "confirm";

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
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState<ResetStep>("request");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFormError(null);
    setNotice(null);

    if (nextMode === "forgot-password") {
      setResetEmail((current) => current || form.email);
      return;
    }

    setResetStep("request");
    setResetOtp("");
    setResetPassword("");
    setResetConfirmPassword("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "forgot-password") return;

    setSubmitting(true);
    setFormError(null);
    setNotice(null);

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

  const handlePasswordResetRequest = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setNotice(null);

    try {
      const response = await api.requestPasswordReset({ email: resetEmail });
      setResetStep("confirm");
      setNotice(response.message);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to send verification code");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordResetConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (resetPassword !== resetConfirmPassword) {
      setFormError("New passwords do not match");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setNotice(null);

    try {
      const response = await api.confirmPasswordReset({
        email: resetEmail,
        otp: resetOtp,
        newPassword: resetPassword,
      });
      setResetStep("request");
      setResetOtp("");
      setResetPassword("");
      setResetConfirmPassword("");
      setMode("login");
      setNotice(response.message);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    setSubmitting(true);
    setFormError(null);
    setNotice(null);

    try {
      const response = await api.requestPasswordReset({ email: resetEmail });
      setNotice(response.message);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to resend verification code");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const googleEnabled =
    mode !== "forgot-password" && googleConfig.enabled && Boolean(googleConfig.clientId);

  const displayError = formError ?? (mode === "forgot-password" ? null : authError);

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
          setNotice(null);
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
          <h1>
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
                ? "Create your account"
                : "Reset your password"}
          </h1>
          <p>
            {mode === "login"
              ? "Sign in to continue to SangamAI"
              : mode === "register"
                ? "Join SangamAI and start collaborating"
                : "Use the verification code sent to your email to set a new password"}
          </p>
        </div>

        <div className="auth-card">
          {mode !== "forgot-password" && (
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === "login" ? "active" : ""}`}
                onClick={() => switchMode("login")}
                type="button"
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${mode === "register" ? "active" : ""}`}
                onClick={() => switchMode("register")}
                type="button"
              >
                Sign Up
              </button>
            </div>
          )}

          {mode !== "forgot-password" ? (
            <>
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
                    placeholder="********"
                    required
                  />
                </div>

                {mode === "login" && (
                  <button
                    className="auth-inline-link"
                    type="button"
                    onClick={() => switchMode("forgot-password")}
                  >
                    Forgot password?
                  </button>
                )}

                {displayError && <div className="auth-error">{displayError}</div>}
                {notice && <div className="auth-success">{notice}</div>}

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
          ) : (
            <form
              className="auth-form"
              onSubmit={resetStep === "request" ? handlePasswordResetRequest : handlePasswordResetConfirm}
            >
              <div className="auth-reset-pill">
                <button
                  className={`auth-reset-step ${resetStep === "request" ? "active" : ""}`}
                  type="button"
                  onClick={() => setResetStep("request")}
                >
                  1. Email
                </button>
                <button
                  className={`auth-reset-step ${resetStep === "confirm" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    if (resetEmail.trim()) {
                      setResetStep("confirm");
                    }
                  }}
                >
                  2. Verify
                </button>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="team@sangam.ai"
                  required
                  autoFocus
                />
              </div>

              {resetStep === "confirm" && (
                <>
                  <div className="form-group">
                    <label>Verification code</label>
                    <input
                      value={resetOtp}
                      onChange={(e) =>
                        setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>New password</label>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm new password</label>
                    <input
                      type="password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      required
                    />
                  </div>
                </>
              )}

              <div className="auth-helper-copy">
                {resetStep === "request"
                  ? "If the account exists, SangamAI will send a 6-digit code to that email."
                  : "Enter the 6-digit code from your email and choose a new password."}
              </div>

              {formError && <div className="auth-error">{formError}</div>}
              {notice && <div className="auth-success">{notice}</div>}

              <button
                className="btn btn-primary"
                disabled={
                  submitting ||
                  !resetEmail.trim() ||
                  (resetStep === "confirm" &&
                    (!resetOtp.trim() ||
                      !resetPassword.trim() ||
                      !resetConfirmPassword.trim()))
                }
                type="submit"
              >
                {submitting
                  ? "Working..."
                  : resetStep === "request"
                    ? "Send verification code"
                    : "Reset password"}
              </button>

              {resetStep === "confirm" && (
                <button
                  className="auth-inline-link"
                  type="button"
                  onClick={() => {
                    void resendCode();
                  }}
                  disabled={submitting || !resetEmail.trim()}
                >
                  Resend code
                </button>
              )}
            </form>
          )}
        </div>

        <div className="auth-footer">
          {mode === "forgot-password" ? (
            <p>
              Remembered it? <a onClick={() => switchMode("login")}>Back to sign in</a>
            </p>
          ) : mode === "login" ? (
            <p>
              Don't have an account? <a onClick={() => switchMode("register")}>Sign up</a>
            </p>
          ) : (
            <p>
              Already have an account? <a onClick={() => switchMode("login")}>Sign in</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

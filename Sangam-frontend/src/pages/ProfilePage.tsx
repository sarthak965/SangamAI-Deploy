import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { applyThemePreference, type ThemePreference } from "../lib/theme";
import type { CurrentUser } from "../types";

type DialogType = "displayName" | "username" | "delete" | null;
type AppearanceOption = {
  id: ThemePreference;
  label: string;
  caption: string;
};

const APPEARANCE_OPTIONS: AppearanceOption[] = [
  { id: "light", label: "Light", caption: "Bright canvas" },
  { id: "system", label: "Auto", caption: "Follow device" },
  { id: "dark", label: "Dark", caption: "Low-light focus" },
];

export default function ProfilePage({
  token,
  me,
  onLogout,
  onProfileUpdated,
}: {
  token: string;
  me: CurrentUser;
  onLogout: () => void;
  onProfileUpdated: (user: CurrentUser, nextToken?: string) => void;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState(me.displayName);
  const [usernameDraft, setUsernameDraft] = useState(me.username);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDisplayNameDraft(me.displayName);
    setUsernameDraft(me.username);
  }, [me.displayName, me.username]);

  const avatarUrl = useMemo(() => {
    return me.hasAvatar ? api.getUserAvatarUrl(me.id, me.updatedAt) : null;
  }, [me.hasAvatar, me.id, me.updatedAt]);

  const currentAppearance = me.appearancePreference.toLowerCase() as ThemePreference;

  const withBusy = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyKey(null);
    }
  };

  const handleAvatarPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    await withBusy("avatar", async () => {
      const updated = await api.uploadAvatar(token, file);
      onProfileUpdated(updated);
      setNotice("Avatar updated.");
    });
  };

  const handleDisplayNameSave = async () => {
    if (!displayNameDraft.trim()) return;
    await withBusy("displayName", async () => {
      const updated = await api.updateDisplayName(token, displayNameDraft.trim());
      onProfileUpdated(updated);
      setDialog(null);
      setNotice("Full name updated.");
    });
  };

  const handleUsernameSave = async () => {
    if (!usernameDraft.trim()) return;
    await withBusy("username", async () => {
      const updated = await api.updateUsername(token, usernameDraft.trim());
      onProfileUpdated(updated.user, updated.token);
      setDialog(null);
      setNotice("Username updated.");
    });
  };

  const handleAppearanceChange = async (preference: ThemePreference) => {
    if (preference === currentAppearance) return;

    const previousPreference = currentAppearance;
    applyThemePreference(preference);

    try {
      setBusyKey(`appearance-${preference}`);
      setError(null);
      setNotice(null);
      const updated = await api.updateAppearancePreference(
        token,
        preference.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM",
      );
      onProfileUpdated(updated);
      setNotice(`Appearance set to ${preference}.`);
    } catch (err) {
      applyThemePreference(previousPreference);
      setError(err instanceof Error ? err.message : "Unable to update appearance");
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteAccount = async () => {
    await withBusy("delete-account", async () => {
      await api.deleteAccount(token, deleteConfirmation.trim());
      onLogout();
      navigate("/auth", { replace: true });
    });
  };

  const avatarInitial = me.displayName.charAt(0).toUpperCase();

  const handleRemoveAvatar = async () => {
    await withBusy("remove-avatar", async () => {
      const updated = await api.removeAvatar(token);
      onProfileUpdated(updated);
      setNotice("Avatar removed.");
    });
  };

  return (
    <div className="profile-settings-page">
      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          void handleAvatarPick(event);
        }}
      />

      <section className="settings-section">
        <div className="settings-section-head">
          <div>
            <h1>Account</h1>
            <p>Manage your identity, avatar, and core profile details.</p>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="profile-notice">{notice}</div>}

        <div className="account-card">
          <div className="account-row account-row-primary">
            <div className="account-identity">
              <div className="account-avatar-shell">
                {avatarUrl ? (
                  <img className="account-avatar-image" src={avatarUrl} alt={`${me.displayName} avatar`} />
                ) : (
                  <div className="account-avatar-fallback">{avatarInitial}</div>
                )}
              </div>
              <div className="account-identity-copy">
                <strong>{me.displayName}</strong>
                <span>{me.username}</span>
              </div>
            </div>

            <div className="profile-avatar-actions">
              <button
                className="btn btn-secondary profile-action-button"
                type="button"
                disabled={busyKey === "avatar"}
                onClick={() => fileInputRef.current?.click()}
              >
                {busyKey === "avatar" ? "Uploading..." : "Change avatar"}
              </button>
              {me.hasAvatar && (
                <button
                  className="btn btn-secondary profile-action-button"
                  type="button"
                  disabled={busyKey === "remove-avatar"}
                  onClick={() => {
                    void handleRemoveAvatar();
                  }}
                >
                  {busyKey === "remove-avatar" ? "Removing..." : "Delete avatar"}
                </button>
              )}
            </div>
          </div>

          <AccountField
            label="Full Name"
            value={me.displayName}
            actionLabel="Change full name"
            onAction={() => setDialog("displayName")}
          />

          <AccountField
            label="Username"
            value={me.username}
            actionLabel="Change username"
            onAction={() => setDialog("username")}
          />

          <AccountField
            label="Email"
            value={me.email}
            muted
          />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <div>
            <h2>Appearance</h2>
            <p>Choose how SangamAI should feel across the app.</p>
          </div>
        </div>

        <div className="appearance-panel">
          <div className="appearance-subtitle">Color mode</div>
          <div className="appearance-option-grid">
            {APPEARANCE_OPTIONS.map((option) => {
              const active = currentAppearance === option.id;
              const busy = busyKey === `appearance-${option.id}`;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`appearance-card ${active ? "active" : ""}`}
                  onClick={() => {
                    void handleAppearanceChange(option.id);
                  }}
                  disabled={busy}
                >
                  <div className={`appearance-preview ${option.id}`}>
                    <span className="appearance-preview-pill left" />
                    <span className="appearance-preview-pill right" />
                    <div className="appearance-preview-lines">
                      <span />
                      <span />
                    </div>
                    <div className="appearance-preview-composer" />
                    <div className="appearance-preview-accent" />
                  </div>
                  <strong>{busy ? "Saving..." : option.label}</strong>
                  <span>{option.caption}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="settings-section danger">
        <div className="settings-section-head">
          <div>
            <h2>Delete account</h2>
            <p>This permanently removes your personal workspace and any environments you host.</p>
          </div>
          <button
            className="btn profile-danger-button"
            type="button"
            onClick={() => {
              setDeleteConfirmation("");
              setDialog("delete");
            }}
          >
            Delete account
          </button>
        </div>
      </section>

      {dialog === "displayName" && (
        <ProfileDialog
          title="Change full name"
          subtitle="Update the full name shown across SangamAI."
          onClose={() => setDialog(null)}
          onSubmit={() => {
            void handleDisplayNameSave();
          }}
          submitLabel={busyKey === "displayName" ? "Saving..." : "Save full name"}
          submitDisabled={!displayNameDraft.trim()}
        >
          <label className="profile-dialog-label">
            Full Name
            <input
              className="dialog-input"
              value={displayNameDraft}
              onChange={(event) => setDisplayNameDraft(event.target.value)}
              placeholder="Your full name"
              autoFocus
            />
          </label>
        </ProfileDialog>
      )}

      {dialog === "username" && (
        <ProfileDialog
          title="Change username"
          subtitle="This changes how people find and mention you. Letters, numbers, periods, and underscores only."
          onClose={() => setDialog(null)}
          onSubmit={() => {
            void handleUsernameSave();
          }}
          submitLabel={busyKey === "username" ? "Saving..." : "Save username"}
          submitDisabled={!usernameDraft.trim()}
        >
          <label className="profile-dialog-label">
            Username
            <input
              className="dialog-input"
              value={usernameDraft}
              onChange={(event) => setUsernameDraft(event.target.value)}
              placeholder="sarthakcha43500"
              autoFocus
            />
          </label>
        </ProfileDialog>
      )}

      {dialog === "delete" && (
        <ProfileDialog
          title="Delete account"
          subtitle="This cannot be undone. Type DELETE to confirm."
          onClose={() => setDialog(null)}
          onSubmit={() => {
            void handleDeleteAccount();
          }}
          submitLabel={busyKey === "delete-account" ? "Deleting..." : "Delete forever"}
          submitDisabled={deleteConfirmation.trim().toUpperCase() !== "DELETE"}
          danger
        >
          <div className="profile-delete-warning">
            <p>Your projects, chats, uploaded avatar, and hosted environments will be permanently removed.</p>
            <label className="profile-dialog-label">
              Confirmation
              <input
                className="dialog-input"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="Type DELETE"
                autoFocus
              />
            </label>
          </div>
        </ProfileDialog>
      )}
    </div>
  );
}

function AccountField({
  label,
  value,
  actionLabel,
  onAction,
  muted = false,
}: {
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
  muted?: boolean;
}) {
  return (
    <div className="account-row">
      <div className="account-field-copy">
        <span>{label}</span>
        <strong className={muted ? "muted" : ""}>{value}</strong>
      </div>
      {actionLabel && onAction ? (
        <button className="btn btn-secondary profile-action-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ProfileDialog({
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  danger = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card profile-dialog-card" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head profile-dialog-head">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="project-dialog-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dialog-body profile-dialog-body">{children}</div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? "dialog-danger" : "btn-primary"}`}
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

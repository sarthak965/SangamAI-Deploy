import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import { applyThemePreference, type ThemePreference } from "../lib/theme";
import type { CurrentUser } from "../types";

type DialogType = "displayName" | "username" | "delete" | "password" | null;
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
  const [passwordDraft, setPasswordDraft] = useState({ current: "", next: "", confirm: "" });
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

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
    setToast(null);
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
      setToast("Avatar updated.");
    });
  };

  const handleDisplayNameSave = async () => {
    if (!displayNameDraft.trim()) return;
    await withBusy("displayName", async () => {
      const updated = await api.updateDisplayName(token, displayNameDraft.trim());
      onProfileUpdated(updated);
      setDialog(null);
      setToast("Full name updated.");
    });
  };

  const handleUsernameSave = async () => {
    if (!usernameDraft.trim()) return;
    await withBusy("username", async () => {
      const updated = await api.updateUsername(token, usernameDraft.trim());
      onProfileUpdated(updated.user, updated.token);
      setDialog(null);
      setToast("Username updated.");
    });
  };

  const handleAppearanceChange = async (preference: ThemePreference) => {
    if (preference === currentAppearance) return;
    if (preference === "light") {
      setToast("Coming soon");
      return;
    }

    const previousPreference = currentAppearance;
    applyThemePreference(preference);

    try {
      setBusyKey(`appearance-${preference}`);
      setError(null);
      setToast(null);
      const updated = await api.updateAppearancePreference(
        token,
        preference.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM",
      );
      onProfileUpdated(updated);
      setToast(`Appearance set to ${preference}.`);
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
      setToast("Avatar removed.");
    });
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

      <div className="profile-settings-container">
        {error && <div className="profile-error-banner">{error}</div>}
        {toast && <div className="profile-toast">{toast}</div>}

        <ProfileHeader
          avatarUrl={avatarUrl}
          avatarInitial={avatarInitial}
          name={me.displayName}
          username={me.username}
          secondary="Account details and preferences"
          onEdit={() => setDialog("displayName")}
          onAvatarChange={() => fileInputRef.current?.click()}
          onAvatarRemove={me.hasAvatar ? () => void handleRemoveAvatar() : undefined}
          busyKey={busyKey}
        />

        <AccountSection
          name={me.displayName}
          username={me.username}
          email={me.email}
          onEditName={() => setDialog("displayName")}
          onEditUsername={() => setDialog("username")}
          onChangePassword={() => {
            setPasswordDraft({ current: "", next: "", confirm: "" });
            setDialog("password");
          }}
        />

        <AppearanceSection
          currentAppearance={currentAppearance}
          busyKey={busyKey}
          onSelect={(id) => void handleAppearanceChange(id)}
        />

        <DangerZone
          onLogout={() => setLogoutConfirmOpen(true)}
          onDelete={() => {
            setDeleteConfirmation("");
            setDialog("delete");
          }}
        />
      </div>

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

      {dialog === "password" && (
        <ProfileDialog
          title="Change password"
          subtitle="Update your password to keep your account secure."
          onClose={() => setDialog(null)}
          onSubmit={() => {
            void withBusy("password", async () => {
              await api.updatePassword(token, {
                currentPassword: passwordDraft.current,
                newPassword: passwordDraft.next,
              });
              setDialog(null);
              setToast("Password updated.");
            });
          }}
          submitLabel={busyKey === "password" ? "Saving..." : "Save password"}
          submitDisabled={
            !passwordDraft.current.trim() ||
            !passwordDraft.next.trim() ||
            passwordDraft.next !== passwordDraft.confirm
          }
        >
          <label className="profile-dialog-label">
            Current password
            <input
              className="dialog-input"
              type="password"
              value={passwordDraft.current}
              onChange={(event) =>
                setPasswordDraft((prev) => ({ ...prev, current: event.target.value }))
              }
              autoFocus
            />
          </label>
          <label className="profile-dialog-label">
            New password
            <input
              className="dialog-input"
              type="password"
              value={passwordDraft.next}
              onChange={(event) =>
                setPasswordDraft((prev) => ({ ...prev, next: event.target.value }))
              }
            />
          </label>
          <label className="profile-dialog-label">
            Confirm new password
            <input
              className="dialog-input"
              type="password"
              value={passwordDraft.confirm}
              onChange={(event) =>
                setPasswordDraft((prev) => ({ ...prev, confirm: event.target.value }))
              }
            />
          </label>
        </ProfileDialog>
      )}

      {logoutConfirmOpen && (
        <Modal onClose={() => setLogoutConfirmOpen(false)} className="profile-logout-modal">
          <div className="profile-modal-header">
            <h3>Log out?</h3>
            <p>Are you sure you want to log out?</p>
          </div>
          <div className="profile-modal-actions">
            <button className="btn btn-secondary" type="button" onClick={() => setLogoutConfirmOpen(false)}>
              Cancel
            </button>
            <button
              className="btn profile-danger-button"
              type="button"
              onClick={() => {
                setLogoutConfirmOpen(false);
                onLogout();
              }}
            >
              Logout
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProfileHeader({
  avatarUrl,
  avatarInitial,
  name,
  username,
  secondary,
  onEdit,
  onAvatarChange,
  onAvatarRemove,
  busyKey,
}: {
  avatarUrl: string | null;
  avatarInitial: string;
  name: string;
  username: string;
  secondary: string;
  onEdit: () => void;
  onAvatarChange: () => void;
  onAvatarRemove?: () => void;
  busyKey: string | null;
}) {
  return (
    <section className="profile-card profile-header-card">
      <div className="profile-header-main">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${name} avatar`} />
          ) : (
            <span>{avatarInitial}</span>
          )}
        </div>
        <div className="profile-header-copy">
          <div className="profile-header-title">
            <strong>{name}</strong>
            <span>@{username}</span>
          </div>
          <p>{secondary}</p>
        </div>
      </div>
      <div className="profile-header-actions">
        <button className="btn profile-ghost-button" type="button" onClick={onEdit}>
          Edit Profile
        </button>
        <button
          className="btn profile-ghost-button"
          type="button"
          disabled={busyKey === "avatar"}
          onClick={onAvatarChange}
        >
          {busyKey === "avatar" ? "Uploading..." : "Change avatar"}
        </button>
        {onAvatarRemove && (
          <button
            className="btn profile-ghost-button"
            type="button"
            disabled={busyKey === "remove-avatar"}
            onClick={onAvatarRemove}
          >
            {busyKey === "remove-avatar" ? "Removing..." : "Delete avatar"}
          </button>
        )}
      </div>
    </section>
  );
}

function AccountSection({
  name,
  username,
  email,
  onEditName,
  onEditUsername,
  onChangePassword,
}: {
  name: string;
  username: string;
  email: string;
  onEditName: () => void;
  onEditUsername: () => void;
  onChangePassword: () => void;
}) {
  return (
    <section className="profile-card">
      <div className="profile-card-head">
        <h2>Account info</h2>
        <p>Keep your personal details up to date.</p>
      </div>
      <div className="profile-field-row">
        <div className="profile-field-label">Full name</div>
        <div className="profile-field-value">{name}</div>
        <button className="profile-inline-action" type="button" onClick={onEditName}>
          Edit
        </button>
      </div>
      <div className="profile-field-divider" />
      <div className="profile-field-row">
        <div className="profile-field-label">Username</div>
        <div className="profile-field-value">@{username}</div>
        <button className="profile-inline-action" type="button" onClick={onEditUsername}>
          Edit
        </button>
      </div>
      <div className="profile-field-divider" />
      <div className="profile-field-row">
        <div className="profile-field-label">Email</div>
        <div className="profile-field-value">
          <a className="profile-link" href={`mailto:${email}`}>
            {email}
          </a>
        </div>
        <span className="profile-inline-muted">Managed</span>
      </div>
      <div className="profile-field-divider" />
      <div className="profile-field-row">
        <div className="profile-field-label">Password</div>
        <div className="profile-field-value">••••••••</div>
        <button className="profile-inline-action" type="button" onClick={onChangePassword}>
          Change
        </button>
      </div>
    </section>
  );
}

function AppearanceSection({
  currentAppearance,
  busyKey,
  onSelect,
}: {
  currentAppearance: ThemePreference;
  busyKey: string | null;
  onSelect: (id: ThemePreference) => void;
}) {
  return (
    <section className="profile-card">
      <div className="profile-card-head">
        <h2>Appearance</h2>
        <p>Choose the theme that suits your focus.</p>
      </div>
      <div className="profile-appearance-grid">
        {APPEARANCE_OPTIONS.map((option) => {
          const active = currentAppearance === option.id;
          const busy = busyKey === `appearance-${option.id}`;
          const disabled = option.id === "light";
          return (
            <button
              key={option.id}
              type="button"
              className={`appearance-card ${active ? "active" : ""} ${disabled ? "disabled" : ""}`}
              onClick={() => onSelect(option.id)}
              aria-disabled={disabled || busy}
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
    </section>
  );
}

function DangerZone({
  onLogout,
  onDelete,
}: {
  onLogout: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="profile-card profile-danger-card">
      <div className="profile-card-head">
        <h2>Danger zone</h2>
        <p>Proceed carefully. These actions are permanent.</p>
      </div>
      <div className="profile-danger-actions">
        <button className="btn profile-ghost-button" type="button" onClick={onLogout}>
          Logout
        </button>
        <button className="btn profile-danger-button" type="button" onClick={onDelete}>
          Delete account
        </button>
      </div>
    </section>
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
    <Modal onClose={onClose} className="dialog-card profile-dialog-card">
      <div className="dialog-head profile-dialog-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <button type="button" className="project-dialog-close" onClick={onClose}>
          x
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
    </Modal>
  );
}


import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { CurrentUser, UserProfileResponse } from "../types";

export default function FriendProfilePage({
  token,
  me,
}: {
  token: string;
  me: CurrentUser;
}) {
  const navigate = useNavigate();
  const { username } = useParams();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const loadProfile = async () => {
    if (!username) return;
    const data = await api.getUserProfile(token, username);
    setProfile(data);
  };

  useEffect(() => {
    loadProfile().catch((err: Error) => setError(err.message));
  }, [token, username]);

  if (!profile) {
    return (
      <div className="empty-state">
        <h4>{error ? "Profile unavailable" : "Loading profile..."}</h4>
        <p>{error ?? "Fetching public profile details."}</p>
      </div>
    );
  }

  const isSelf = profile.id === me.id || profile.friendshipStatus === "SELF";

  return (
    <div className="friend-profile-page">
      {error && <div className="error-banner">{error}</div>}

      <button className="project-back-link" type="button" onClick={() => navigate("/app/friends")}>
        ← Back to friends
      </button>

      <section className="friend-profile-card">
        <div className="friend-profile-identity">
          {profile.hasAvatar ? (
            <img
              className="friend-profile-avatar-image"
              src={api.getUserAvatarUrl(profile.id, profile.updatedAt)}
              alt={`${profile.displayName} avatar`}
            />
          ) : (
            <div className="friend-profile-avatar-fallback">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="friend-profile-copy">
            <h1>{profile.displayName}</h1>
            <p>@{profile.username}</p>
            <span className="friendship-pill">{friendshipLabel(profile.friendshipStatus)}</span>
          </div>
        </div>

        {!isSelf && (
          <div className="friend-profile-actions">
            {profile.friendshipStatus === "NONE" && (
              <button
                className="btn btn-primary"
                type="button"
                disabled={busyKey === "send-request"}
                onClick={() => {
                  setBusyKey("send-request");
                  setError(null);
                  api.sendFriendRequest(token, profile.username)
                    .then(() => loadProfile())
                    .catch((err: Error) => setError(err.message))
                    .finally(() => setBusyKey(null));
                }}
              >
                {busyKey === "send-request" ? "Sending..." : "Add friend"}
              </button>
            )}

            {profile.friendshipStatus === "FRIENDS" && (
              <button className="btn btn-secondary" type="button" onClick={() => setConfirmRemove(true)}>
                Remove friend
              </button>
            )}

            {profile.friendshipStatus === "OUTGOING_REQUEST" && (
              <button className="btn btn-secondary" type="button" disabled>
                Request sent
              </button>
            )}

            {profile.friendshipStatus === "INCOMING_REQUEST" && (
              <button className="btn btn-secondary" type="button" onClick={() => navigate("/app/friends")}>
                Respond in notifications
              </button>
            )}
          </div>
        )}
      </section>

      {confirmRemove && (
        <div className="dialog-backdrop" onClick={() => setConfirmRemove(false)}>
          <div className="dialog-card profile-dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-head profile-dialog-head">
              <div>
                <h3>Remove friend</h3>
                <p>Remove @{profile.username} from your friends list?</p>
              </div>
              <button type="button" className="project-dialog-close" onClick={() => setConfirmRemove(false)}>
                ×
              </button>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
              <button
                className="btn dialog-danger"
                type="button"
                disabled={busyKey === "remove-friend"}
                onClick={() => {
                  setBusyKey("remove-friend");
                  setError(null);
                  api.removeFriend(token, profile.id)
                    .then(() => navigate("/app/friends"))
                    .catch((err: Error) => setError(err.message))
                    .finally(() => setBusyKey(null));
                }}
              >
                {busyKey === "remove-friend" ? "Removing..." : "Remove friend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function friendshipLabel(status: UserProfileResponse["friendshipStatus"]) {
  switch (status) {
    case "SELF":
      return "You";
    case "FRIENDS":
      return "Friends";
    case "OUTGOING_REQUEST":
      return "Request sent";
    case "INCOMING_REQUEST":
      return "Sent you a request";
    default:
      return "Not connected";
  }
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type {
  CurrentUser,
  FriendRequestResponse,
  FriendUser,
  FriendsOverviewResponse,
} from "../types";

type TabKey = "requests" | "friends";
type ConfirmState =
  | { type: "remove-friend"; friend: FriendUser }
  | { type: "decline-request"; request: FriendRequestResponse }
  | { type: "cancel-request"; request: FriendRequestResponse }
  | null;

export default function FriendsPage({
  token,
  me,
}: {
  token: string;
  me: CurrentUser;
}) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<FriendsOverviewResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("requests");
  const [addUsername, setAddUsername] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const loadOverview = async () => {
    const data = await api.getFriendsOverview(token);
    setOverview(data);
  };

  useEffect(() => {
    loadOverview().catch((err: Error) => setError(err.message));
  }, [token]);

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

  const filteredFriends = useMemo(() => {
    const query = friendSearch.trim().toLowerCase();
    if (!query) return overview?.friends ?? [];
    return (overview?.friends ?? []).filter((friend) =>
      `${friend.displayName} ${friend.username}`.toLowerCase().includes(query),
    );
  }, [friendSearch, overview?.friends]);

  const pendingCount = overview?.incomingRequests.length ?? 0;

  return (
    <div className="friends-page">
      <section className="friends-hero">
        <div>
          <h1>Friends</h1>
          <p>Send requests, review notifications, and keep a clean list of the people you know on SangamAI.</p>
        </div>

        <div className="friends-add-card">
          <strong>Add a friend</strong>
          <form
            className="friends-add-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!addUsername.trim()) return;
              void withBusy("send-request", async () => {
                await api.sendFriendRequest(token, addUsername.trim());
                setAddUsername("");
                await loadOverview();
                setActiveTab("requests");
                setNotice("Friend request sent.");
              });
            }}
          >
            <input
              value={addUsername}
              onChange={(event) => setAddUsername(event.target.value)}
              placeholder="Enter a username"
            />
            <button className="btn btn-primary" type="submit" disabled={busyKey === "send-request"}>
              {busyKey === "send-request" ? "Sending..." : "Send request"}
            </button>
          </form>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="profile-notice">{notice}</div>}

      <section className="friends-panel">
        <div className="friends-tab-row">
          <button
            type="button"
            className={`friends-tab ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            Request notifications
            {pendingCount > 0 && <span className="friends-badge">{pendingCount}</span>}
          </button>
          <button
            type="button"
            className={`friends-tab ${activeTab === "friends" ? "active" : ""}`}
            onClick={() => setActiveTab("friends")}
          >
            Your friends
            <span className="friends-badge muted">{overview?.friends.length ?? 0}</span>
          </button>
        </div>

        {activeTab === "requests" ? (
          <div className="friends-grid">
            <div className="friends-column">
              <div className="friends-column-head">
                <h2>Incoming requests</h2>
                <span>{overview?.incomingRequests.length ?? 0}</span>
              </div>
              {overview?.incomingRequests.length ? (
                overview.incomingRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    actionLabel={busyKey === `accept-${request.id}` ? "Accepting..." : "Accept"}
                    secondaryLabel="Decline"
                    onPrimary={() =>
                      void withBusy(`accept-${request.id}`, async () => {
                        await api.acceptFriendRequest(token, request.id);
                        await loadOverview();
                        setNotice(`You and @${request.user.username} are now friends.`);
                      })
                    }
                    onSecondary={() => setConfirmState({ type: "decline-request", request })}
                    onViewProfile={() => navigate(`/app/friends/${request.user.username}`)}
                  />
                ))
              ) : (
                <EmptyPanel
                  title="No incoming requests"
                  body="When someone adds you, their request will appear here."
                />
              )}
            </div>

            <div className="friends-column">
              <div className="friends-column-head">
                <h2>Sent requests</h2>
                <span>{overview?.outgoingRequests.length ?? 0}</span>
              </div>
              {overview?.outgoingRequests.length ? (
                overview.outgoingRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    actionLabel="Pending"
                    secondaryLabel="Cancel"
                    disablePrimary
                    onPrimary={() => undefined}
                    onSecondary={() => setConfirmState({ type: "cancel-request", request })}
                    onViewProfile={() => navigate(`/app/friends/${request.user.username}`)}
                  />
                ))
              ) : (
                <EmptyPanel
                  title="No sent requests"
                  body="Requests you send will stay here until the other person accepts them."
                />
              )}
            </div>
          </div>
        ) : (
          <div className="friends-list-panel">
            <div className="friends-list-head">
              <div>
                <h2>Your friends</h2>
                <p>{overview?.friends.length ?? 0} people in your network.</p>
              </div>
              <input
                value={friendSearch}
                onChange={(event) => setFriendSearch(event.target.value)}
                className="friends-search"
                placeholder="Search friends"
              />
            </div>

            {filteredFriends.length ? (
              <div className="friends-list">
                {filteredFriends.map((friend) => (
                  <div key={friend.id} className="friend-row">
                    <button
                      type="button"
                      className="friend-row-main"
                      onClick={() => navigate(`/app/friends/${friend.username}`)}
                    >
                      <Avatar user={friend} />
                      <div className="friend-row-copy">
                        <strong>{friend.displayName}</strong>
                        <span>@{friend.username}</span>
                      </div>
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => setConfirmState({ type: "remove-friend", friend })}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title={overview?.friends.length ? "No matches" : "No friends yet"}
                body={
                  overview?.friends.length
                    ? "Try another name or username."
                    : "Once requests are accepted, your friends list will appear here."
                }
              />
            )}
          </div>
        )}
      </section>

      {confirmState && (
        <FriendsConfirmDialog
          title={
            confirmState.type === "remove-friend"
              ? "Remove friend"
              : confirmState.type === "decline-request"
                ? "Decline request"
                : "Cancel request"
          }
          body={
            confirmState.type === "remove-friend"
              ? `Remove @${confirmState.friend.username} from your friends list?`
              : confirmState.type === "decline-request"
                ? `Decline the friend request from @${confirmState.request.user.username}?`
                : `Cancel the friend request to @${confirmState.request.user.username}?`
          }
          confirmLabel={
            confirmState.type === "remove-friend"
              ? "Remove friend"
              : confirmState.type === "decline-request"
                ? "Decline"
                : "Cancel request"
          }
          onClose={() => setConfirmState(null)}
          onConfirm={() => {
            if (confirmState.type === "remove-friend") {
              void withBusy(`remove-friend-${confirmState.friend.id}`, async () => {
                await api.removeFriend(token, confirmState.friend.id);
                setConfirmState(null);
                await loadOverview();
                setNotice(`Removed @${confirmState.friend.username}.`);
              });
              return;
            }

            if (confirmState.type === "decline-request") {
              void withBusy(`decline-${confirmState.request.id}`, async () => {
                await api.removeFriendRequest(token, confirmState.request.id, "incoming");
                setConfirmState(null);
                await loadOverview();
                setNotice(`Declined @${confirmState.request.user.username}.`);
              });
              return;
            }

            void withBusy(`cancel-${confirmState.request.id}`, async () => {
              await api.removeFriendRequest(token, confirmState.request.id, "outgoing");
              setConfirmState(null);
              await loadOverview();
              setNotice(`Cancelled request to @${confirmState.request.user.username}.`);
            });
          }}
          danger={confirmState.type !== "cancel-request"}
        />
      )}
    </div>
  );
}

function RequestCard({
  request,
  actionLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onViewProfile,
  disablePrimary = false,
}: {
  request: FriendRequestResponse;
  actionLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onViewProfile: () => void;
  disablePrimary?: boolean;
}) {
  return (
    <div className="friend-request-card">
      <button type="button" className="friend-request-main" onClick={onViewProfile}>
        <Avatar user={request.user} />
        <div className="friend-request-copy">
          <strong>{request.user.displayName}</strong>
          <span>@{request.user.username}</span>
          <em>{relativeTime(request.createdAt)}</em>
        </div>
      </button>
      <div className="friend-request-actions">
        <button className="btn btn-primary btn-sm" type="button" onClick={onPrimary} disabled={disablePrimary}>
          {actionLabel}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

function Avatar({ user }: { user: FriendUser }) {
  return user.hasAvatar ? (
    <img
      className="friend-avatar-image"
      src={api.getUserAvatarUrl(user.id, user.updatedAt)}
      alt={`${user.displayName} avatar`}
    />
  ) : (
    <div className="friend-avatar-fallback">{user.displayName.charAt(0).toUpperCase()}</div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state friends-empty-state">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

function FriendsConfirmDialog({
  title,
  body,
  confirmLabel,
  onClose,
  onConfirm,
  danger = false,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card profile-dialog-card" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head profile-dialog-head">
          <div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
          <button type="button" className="project-dialog-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={`btn ${danger ? "dialog-danger" : "btn-primary"}`} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

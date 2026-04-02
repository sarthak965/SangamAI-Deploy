import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Modal from "../components/Modal";
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
  const addInputRef = useRef<HTMLInputElement>(null);
  const [overview, setOverview] = useState<FriendsOverviewResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("requests");
  const [addUsername, setAddUsername] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

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
    setToast(null);
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

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <div className="friends-page">
      <section className="friends-hero">
        <div className="friends-hero-copy">
          <h1>Friends</h1>
          <p>Build your inner circle and collaborate in real time.</p>
        </div>
        <AddFriendCard
          value={addUsername}
          onChange={setAddUsername}
          inputRef={addInputRef}
          busy={busyKey === "send-request"}
          onSubmit={() => {
            if (!addUsername.trim()) return;
            void withBusy("send-request", async () => {
              await api.sendFriendRequest(token, addUsername.trim());
              setAddUsername("");
              await loadOverview();
              setActiveTab("requests");
              setToast("Request sent");
            });
          }}
        />
      </section>

      {error && <div className="friends-error-banner">{error}</div>}
      {toast && <div className="friends-toast">{toast}</div>}

      <section className="friends-panel">
        <Tabs
          active={activeTab}
          pendingCount={pendingCount}
          friendCount={overview?.friends.length ?? 0}
          onChange={setActiveTab}
        />

        <div className={`friends-tab-panel ${activeTab}`}>
          {activeTab === "requests" ? (
            <div className="friends-requests-grid">
              <div className="friends-column">
                <div className="friends-column-head">
                  <h2>Incoming</h2>
                  <span>{overview?.incomingRequests.length ?? 0}</span>
                </div>
                {overview?.incomingRequests.length ? (
                  overview.incomingRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      actionLabel={busyKey === `accept-${request.id}` ? "Accepting..." : "Accept"}
                      secondaryLabel="Decline"
                      removing={removingIds.has(request.id)}
                      onPrimary={() => {
                        setRemovingIds((prev) => new Set(prev).add(request.id));
                        void withBusy(`accept-${request.id}`, async () => {
                          try {
                            await api.acceptFriendRequest(token, request.id);
                            await loadOverview();
                            setToast(`You and @${request.user.username} are now friends.`);
                          } finally {
                            setRemovingIds((prev) => {
                              const next = new Set(prev);
                              next.delete(request.id);
                              return next;
                            });
                          }
                        });
                      }}
                      onSecondary={() => setConfirmState({ type: "decline-request", request })}
                      onViewProfile={() => navigate(`/app/friends/${request.user.username}`)}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No incoming requests"
                    body="When someone adds you, their request will land here."
                    onCta={() => addInputRef.current?.focus()}
                  />
                )}
              </div>

              <div className="friends-column">
                <div className="friends-column-head">
                  <h2>Sent</h2>
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
                      removing={removingIds.has(request.id)}
                      onPrimary={() => undefined}
                      onSecondary={() => setConfirmState({ type: "cancel-request", request })}
                      onViewProfile={() => navigate(`/app/friends/${request.user.username}`)}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No sent requests"
                    body="Requests you send will appear here until accepted."
                    onCta={() => addInputRef.current?.focus()}
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
                    <FriendCard
                      key={friend.id}
                      friend={friend}
                      onProfile={() => navigate(`/app/friends/${friend.username}`)}
                      onRemove={() => setConfirmState({ type: "remove-friend", friend })}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={overview?.friends.length ? "No matches" : "No friends yet"}
                  body={
                    overview?.friends.length
                      ? "Try another name or username."
                      : "Start by adding people you know."
                  }
                  onCta={() => addInputRef.current?.focus()}
                />
              )}
            </div>
          )}
        </div>
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
                setToast(`Removed @${confirmState.friend.username}.`);
              });
              return;
            }

            if (confirmState.type === "decline-request") {
              setRemovingIds((prev) => new Set(prev).add(confirmState.request.id));
              void withBusy(`decline-${confirmState.request.id}`, async () => {
                try {
                  await api.removeFriendRequest(token, confirmState.request.id, "incoming");
                  setConfirmState(null);
                  await loadOverview();
                  setToast(`Declined @${confirmState.request.user.username}.`);
                } finally {
                  setRemovingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(confirmState.request.id);
                    return next;
                  });
                }
              });
              return;
            }

            setRemovingIds((prev) => new Set(prev).add(confirmState.request.id));
            void withBusy(`cancel-${confirmState.request.id}`, async () => {
              try {
                await api.removeFriendRequest(token, confirmState.request.id, "outgoing");
                setConfirmState(null);
                await loadOverview();
                setToast(`Cancelled request to @${confirmState.request.user.username}.`);
              } finally {
                setRemovingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(confirmState.request.id);
                  return next;
                });
              }
            });
          }}
          danger={confirmState.type !== "cancel-request"}
        />
      )}
    </div>
  );
}

function AddFriendCard({
  value,
  onChange,
  onSubmit,
  inputRef,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  busy: boolean;
}) {
  return (
    <div className="friends-add-card">
      <div>
        <strong>Add a friend</strong>
        <p>Send a request to someone you know.</p>
      </div>
      <form
        className="friends-add-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter a username"
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Sending..." : "Send request"}
        </button>
      </form>
    </div>
  );
}

function Tabs({
  active,
  pendingCount,
  friendCount,
  onChange,
}: {
  active: TabKey;
  pendingCount: number;
  friendCount: number;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <div className="friends-tabs">
      <button
        type="button"
        className={`friends-tab ${active === "requests" ? "active" : ""}`}
        onClick={() => onChange("requests")}
      >
        Requests
        {pendingCount > 0 && <span className="friends-badge">{pendingCount}</span>}
      </button>
      <button
        type="button"
        className={`friends-tab ${active === "friends" ? "active" : ""}`}
        onClick={() => onChange("friends")}
      >
        Friends
        <span className="friends-badge muted">{friendCount}</span>
      </button>
      <span className={`friends-tab-indicator ${active}`} />
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
  removing = false,
}: {
  request: FriendRequestResponse;
  actionLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onViewProfile: () => void;
  disablePrimary?: boolean;
  removing?: boolean;
}) {
  return (
    <div className={`friend-request-card ${removing ? "removing" : ""}`}>
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

function FriendCard({
  friend,
  onProfile,
  onRemove,
}: {
  friend: FriendUser;
  onProfile: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="friend-card">
      <button type="button" className="friend-card-main" onClick={onProfile}>
        <Avatar user={friend} />
        <div className="friend-card-copy">
          <strong>{friend.displayName}</strong>
          <span>@{friend.username}</span>
        </div>
      </button>
      <div className="friend-card-status">Friend</div>
      <button className="btn btn-secondary btn-sm" type="button" onClick={onRemove}>
        Remove
      </button>
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

function EmptyState({
  title,
  body,
  onCta,
}: {
  title: string;
  body: string;
  onCta: () => void;
}) {
  return (
    <div className="empty-state friends-empty-state">
      <div className="friends-empty-illustration">
        <div className="friends-empty-orbit" />
        <div className="friends-empty-avatar">
          <span>+</span>
        </div>
      </div>
      <h4>{title}</h4>
      <p>{body}</p>
      <button className="btn btn-primary btn-sm" type="button" onClick={onCta}>
        Add Friend
      </button>
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
    <Modal onClose={onClose} className="dialog-card profile-dialog-card">
      <div className="dialog-head profile-dialog-head">
        <div>
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
        <button type="button" className="project-dialog-close" onClick={onClose}>
          x
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
    </Modal>
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



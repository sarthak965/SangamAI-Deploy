import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { realtimeManager } from "../lib/realtime";
import type {
  CurrentUser,
  EnvironmentEventMemberUpdated,
  EnvironmentResponse,
  MemberResponse,
  SessionListItem,
} from "../types";

export default function EnvironmentPage({
  token,
  me,
}: {
  token: string;
  me: CurrentUser;
}) {
  const navigate = useNavigate();
  const { environmentId } = useParams();
  const [environments, setEnvironments] = useState<EnvironmentResponse[]>([]);
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newSessionTitle, setNewSessionTitle] = useState("");

  const environment = useMemo(
    () => environments.find((e) => e.id === environmentId) ?? null,
    [environments, environmentId],
  );

  const loadAll = async () => {
    if (!environmentId) return;
    const [envs, mems, sess] = await Promise.all([
      api.listEnvironments(token),
      api.getMembers(token, environmentId),
      api.listSessions(token, environmentId),
    ]);
    setEnvironments(envs);
    setMembers(mems);
    setSessions(sess);
  };

  useEffect(() => {
    loadAll().catch((e: Error) => setError(e.message));
  }, [environmentId, token]);

  /* realtime member updates */
  useEffect(() => {
    if (!environmentId) return;
    let active = true;
    let cleanup: (() => void) | null = null;

    realtimeManager
      .subscribe<EnvironmentEventMemberUpdated>(
        token,
        `env:${environmentId}`,
        () => {
          if (active) void loadAll().catch((e: Error) => setError(e.message));
        },
      )
      .then((unsub) => {
        if (active) cleanup = unsub;
        else unsub();
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      active = false;
      cleanup?.();
    };
  }, [environmentId, token]);

  const withBusy = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyKey(null);
    }
  };

  const currentMember =
    members.find((m) => m.username === me.username) ?? null;
  const canManage =
    currentMember?.role === "OWNER" || currentMember?.role === "CO_HOST";
  const canChangeRoles = currentMember?.role === "OWNER";

  if (!environmentId || !environment) {
    return (
      <div className="empty-state">
        <h4>Environment not found</h4>
        <p>Go back and choose a valid workspace.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>{environment.name}</h1>
            <div className="env-detail-meta">
              <span>Owner: @{environment.hostUsername}</span>
              <span className="badge">{environment.inviteCode}</span>
            </div>
          </div>
        </div>
        {environment.description && (
          <p style={{ marginTop: "0.5rem" }}>{environment.description}</p>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="env-detail-grid">
        {/* Members panel */}
        <div className="panel">
          <div className="panel-header">
            <h3>Members</h3>
            <span className="count">{members.length}</span>
          </div>

          {canManage && (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                void withBusy("add-member", async () => {
                  await api.addMember(token, environmentId, newUsername);
                  setNewUsername("");
                  await loadAll();
                });
              }}
            >
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Add by username"
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={busyKey === "add-member"}
                type="submit"
              >
                Add
              </button>
            </form>
          )}

          <div className="member-list">
            {members.map((member) => (
              <div key={member.userId} className="member-row">
                <div className="member-info">
                  <strong>
                    {member.displayName}
                    {member.username === me.username ? " (you)" : ""}
                  </strong>
                  <span>
                    @{member.username} · {member.role}
                  </span>
                </div>
                <div className="member-actions">
                  {canManage && !member.owner && member.role !== "CO_HOST" && (
                    <div
                      className={`toggle-switch ${member.canInteractWithAi ? "active" : ""}`}
                      title="AI access"
                      onClick={() =>
                        void withBusy(`perm-${member.username}`, async () => {
                          await api.updatePermission(
                            token,
                            environmentId,
                            member.username,
                            !member.canInteractWithAi,
                          );
                          await loadAll();
                        })
                      }
                    />
                  )}
                  {canChangeRoles && !member.owner && (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busyKey === `role-${member.username}`}
                      onClick={() =>
                        void withBusy(`role-${member.username}`, async () => {
                          await api.updateMemberRole(
                            token,
                            environmentId,
                            member.username,
                            member.role === "CO_HOST" ? "MEMBER" : "CO_HOST",
                          );
                          await loadAll();
                        })
                      }
                    >
                      {member.role === "CO_HOST" ? "Remove co-host" : "Make co-host"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sessions panel */}
        <div className="panel">
          <div className="panel-header">
            <h3>Sessions</h3>
            <span className="count">{sessions.length}</span>
          </div>

          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void withBusy("create-session", async () => {
                const created = await api.createSession(
                  token,
                  environmentId,
                  newSessionTitle || "Untitled session",
                );
                setNewSessionTitle("");
                await loadAll();
                navigate(
                  `/app/environments/${environmentId}/sessions/${created.sessionId}`,
                );
              });
            }}
          >
            <input
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              placeholder="New session title"
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={busyKey === "create-session"}
              type="submit"
            >
              Create
            </button>
          </form>

          <div className="session-list">
            {sessions.length === 0 ? (
              <div className="empty-state">
                <h4>No sessions yet</h4>
                <p>Create a session to start an AI conversation.</p>
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.sessionId}
                  className="session-card"
                  onClick={() =>
                    navigate(
                      `/app/environments/${environmentId}/sessions/${session.sessionId}`,
                    )
                  }
                >
                  <div className="session-card-info">
                    <h4>{session.title || "Untitled"}</h4>
                    <p>
                      {session.createdBy} ·{" "}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="session-status">{session.status}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

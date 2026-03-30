import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { EnvironmentResponse } from "../types";

export default function EnvironmentsPage({ token }: { token: string }) {
  const navigate = useNavigate();
  const [environments, setEnvironments] = useState<EnvironmentResponse[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [inviteCode, setInviteCode] = useState("");
  const createRef = useRef<HTMLDivElement>(null);
  const joinRef = useRef<HTMLDivElement>(null);

  const loadEnvironments = async () => {
    const data = await api.listEnvironments(token);
    setEnvironments(data);
  };

  useEffect(() => {
    loadEnvironments().catch((e: Error) => setError(e.message));
  }, [token]);

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

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  return (
    <div>
      {/* Welcome section */}
      <div className="env-welcome">
        <h2>Your Environments</h2>
        <p>
          Create a new AI collaboration room or join an existing one with an
          invite code.
        </p>
        <div className="env-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowCreate(true);
              setShowJoin(false);
              scrollTo(createRef);
            }}
          >
            Create Environment
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowJoin(true);
              setShowCreate(false);
              scrollTo(joinRef);
            }}
          >
            Join with Code
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Create form */}
      {showCreate && (
        <div className="env-form-section" ref={createRef}>
          <h3>Create a new environment</h3>
          <form
            className="env-form"
            onSubmit={(e) => {
              e.preventDefault();
              void withBusy("create", async () => {
                const created = await api.createEnvironment(token, createForm);
                await loadEnvironments();
                navigate(`/app/environments/${created.id}`);
              });
            }}
          >
            <div className="form-group">
              <label>Room name</label>
              <input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="e.g. Study Group, Team Alpha"
                required
              />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <input
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((s) => ({ ...s, description: e.target.value }))
                }
                placeholder="What's this room about?"
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={busyKey === "create"}
              type="submit"
            >
              {busyKey === "create" ? "Creating..." : "Create Environment"}
            </button>
          </form>
        </div>
      )}

      {/* Join form */}
      {showJoin && (
        <div className="env-form-section" ref={joinRef}>
          <h3>Join an existing environment</h3>
          <form
            className="env-form"
            onSubmit={(e) => {
              e.preventDefault();
              void withBusy("join", async () => {
                const joined = await api.joinEnvironment(token, inviteCode);
                await loadEnvironments();
                navigate(`/app/environments/${joined.id}`);
              });
            }}
          >
            <div className="form-group">
              <label>Invite code</label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="A1B2C3D4"
                required
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={busyKey === "join"}
              type="submit"
            >
              {busyKey === "join" ? "Joining..." : "Join Environment"}
            </button>
          </form>
        </div>
      )}

      {(showCreate || showJoin) && <div className="env-divider">or</div>}

      {/* Environment list */}
      <div className="env-list">
        <div className="env-list-header">
          <h3>Your rooms</h3>
          <span>{environments.length} environments</span>
        </div>

        {environments.length === 0 ? (
          <div className="empty-state">
            <h4>No environments yet</h4>
            <p>Create your first environment to start collaborating with AI.</p>
          </div>
        ) : (
          environments.map((env) => (
            <button
              key={env.id}
              className="env-card"
              onClick={() => navigate(`/app/environments/${env.id}`)}
            >
              <div className="env-card-info">
                <h4>{env.name}</h4>
                <p>{env.description || "No description"}</p>
              </div>
              <span className="env-card-code">{env.inviteCode}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

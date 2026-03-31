import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { CurrentUser, ProjectResponse, SoloChatSummaryResponse } from "../types";

export default function HomePage({
  token,
  me,
  recentChats,
  onWorkspaceChanged,
}: {
  token: string;
  me: CurrentUser;
  recentChats: SoloChatSummaryResponse[];
  onWorkspaceChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const greeting = useMemo(() => {
    const firstName = me.displayName.trim().split(/\s+/)[0];
    return firstName || me.username;
  }, [me.displayName, me.username]);

  useEffect(() => {
    api
      .listProjects(token)
      .then(setProjects)
      .catch((err: Error) => setError(err.message));
  }, [token]);

  useEffect(() => {
    autoSizeTextarea(textareaRef.current, 22, 96);
  }, [draft]);

  const startChat = async (prompt: string, projectId?: string | null) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const chat = await api.createSoloChat(token, { projectId });
      await api.sendSoloMessage(token, chat.id, trimmed);
      await onWorkspaceChanged();
      setDraft("");
      navigate(`/app/chats/${chat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start chat");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="solo-home">
      <div className="solo-home-header">
        <span className="solo-home-badge">SangamAI</span>
      </div>

      <section className="solo-hero">
        <div className="solo-hero-copy">
          <h1>What can SangamAI help with?</h1>
        </div>

        <form
          className="solo-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void startChat(draft);
          }}
        >
          <label className="sr-only" htmlFor="solo-chat-input">
            Start a new chat
          </label>
          <button className="solo-composer-icon solo-composer-icon-left" type="button" aria-label="Attach">
            +
          </button>
          <textarea
            id="solo-chat-input"
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask anything"
            rows={1}
          />
          <div className="solo-composer-actions">
            <button className="solo-composer-icon" type="button" aria-label="Voice input">
              <MicIcon />
            </button>
            <button className="solo-composer-send" type="submit" disabled={busy}>
              <ArrowIcon />
            </button>
          </div>
        </form>

        {error && <div className="solo-composer-note error-text">{error}</div>}

        <div className="solo-suggestions">
          {[
            "Summarize a system design interview topic",
            "Plan my week in focused work blocks",
            "Explain a tricky DP problem in Java",
            "Draft a clean project brief for my team",
          ].map((prompt) => (
            <button
              key={prompt}
              className="solo-suggestion-chip"
              type="button"
              onClick={() => setDraft(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="solo-stats">
          <button className="solo-stat-pill" type="button" onClick={() => navigate("/app/projects")}>
            {projects.length} projects
          </button>
          <span className="solo-stat-pill">{recentChats.length} recent chats</span>
        </div>
      </section>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0v-5A2.5 2.5 0 0 1 12 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M7.5 10.75v.75a4.5 4.5 0 1 0 9 0v-.75M12 16v4M9 20h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 12h8M13 7l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function autoSizeTextarea(
  element: HTMLTextAreaElement | null,
  minHeight: number,
  maxHeight: number,
) {
  if (!element) return;
  element.style.height = `${minHeight}px`;
  const nextHeight = Math.min(element.scrollHeight, maxHeight);
  element.style.height = `${Math.max(minHeight, nextHeight)}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
}

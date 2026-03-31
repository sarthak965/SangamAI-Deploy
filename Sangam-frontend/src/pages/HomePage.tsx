import { useMemo, useState } from "react";
import type { CurrentUser } from "../types";

export interface SoloRecentChat {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
}

export default function HomePage({
  me,
  recentChats,
  onCreateRecent,
}: {
  me: CurrentUser;
  recentChats: SoloRecentChat[];
  onCreateRecent: (prompt: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const greeting = useMemo(() => {
    const firstName = me.displayName.trim().split(/\s+/)[0];
    return firstName || me.username;
  }, [me.displayName, me.username]);

  return (
    <div className="solo-home">
      <div className="solo-home-header">
        <span className="solo-home-badge">SangamAI</span>
        <button className="solo-home-upgrade" type="button">
          Personal AI Workspace
        </button>
      </div>

      <section className="solo-hero">
        <div className="solo-hero-copy">
          <p className="solo-eyebrow">Private chat</p>
          <h1>What should SangamAI help you explore today, {greeting}?</h1>
          <p>
            This is your personal AI space. Environments stay collaborative,
            while this surface is just for you.
          </p>
        </div>

        <form
          className="solo-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            onCreateRecent(draft);
            setDraft("");
          }}
        >
          <label className="sr-only" htmlFor="solo-chat-input">
            Start a new chat
          </label>
          <textarea
            id="solo-chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask SangamAI anything for your personal workflow..."
            rows={3}
          />
          <div className="solo-composer-footer">
            <span>Backend for personal chat/history comes next.</span>
            <button className="btn btn-primary" type="submit">
              Start Chat
            </button>
          </div>
        </form>

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
      </section>

      <section className="solo-recent-grid">
        <div className="solo-panel">
          <div className="solo-panel-header">
            <div>
              <p className="solo-panel-kicker">History</p>
              <h2>Recent personal chats</h2>
            </div>
            <span>{recentChats.length} items</span>
          </div>
          {recentChats.length === 0 ? (
            <div className="solo-empty">
              <h3>No personal chats yet</h3>
              <p>Your new chats will appear here once you start using the solo SangamAI space.</p>
            </div>
          ) : (
            <div className="solo-recent-list">
              {recentChats.map((chat) => (
                <article key={chat.id} className="solo-recent-card">
                  <p className="solo-recent-time">{formatRelativeTime(chat.updatedAt)}</p>
                  <h3>{chat.title}</h3>
                  <p>{chat.preview}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="solo-panel">
          <div className="solo-panel-header">
            <div>
              <p className="solo-panel-kicker">Projects</p>
              <h2>Reserved for the next phase</h2>
            </div>
          </div>
          <div className="solo-empty">
            <h3>Projects are intentionally untouched</h3>
            <p>
              You said you will explain that flow later, so this section is only
              a visual placeholder for now.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

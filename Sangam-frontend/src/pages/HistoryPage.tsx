import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { ProjectResponse, SoloChatSummaryResponse } from "../types";
import ChatOverflowMenu from "../components/ChatOverflowMenu";

export default function HistoryPage({
  token,
  onWorkspaceChanged,
}: {
  token: string;
  onWorkspaceChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [chats, setChats] = useState<SoloChatSummaryResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [chatData, projectData] = await Promise.all([
      api.listSoloChats(token),
      api.listProjects(token),
    ]);
    setChats(chatData);
    setProjects(projectData);
  };

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [token]);

  const filteredChats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return chats;
    return chats.filter((chat) => {
      const haystack = [
        chat.title,
        chat.projectName ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [chats, query]);

  return (
    <div className="history-page">
      <div className="page-header">
        <h1>Your chats</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="history-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats"
        />
      </div>

      <div className="history-list">
        {filteredChats.length === 0 ? (
          <div className="solo-empty">
            <h3>No chats found</h3>
            <p>Start a new personal chat to build your history.</p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <article key={chat.id} className="history-item">
              <button
                className="history-item-main"
                type="button"
                onClick={() => navigate(`/app/chats/${chat.id}`)}
              >
                <span className="history-item-title">
                  {chat.pinned && <strong className="history-pin-mark">Pinned</strong>}
                  {chat.title}
                </span>
                <span className="history-item-meta">
                  {chat.projectName ? `Project: ${chat.projectName}` : "No project"}
                </span>
              </button>

              <div className="history-item-actions">
                <ChatOverflowMenu
                  token={token}
                  chat={chat}
                  projects={projects}
                  onChanged={async () => {
                    await load();
                    await onWorkspaceChanged();
                  }}
                />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

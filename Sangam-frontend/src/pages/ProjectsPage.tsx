import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { ProjectResponse } from "../types";

export default function ProjectsPage({
  token,
  onWorkspaceChanged,
}: {
  token: string;
  onWorkspaceChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    systemInstructions: "",
    knowledgeContext: "",
  });

  const loadProjects = async () => {
    const data = await api.listProjects(token);
    setProjects(data);
  };

  useEffect(() => {
    loadProjects().catch((err: Error) => setError(err.message));
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      systemInstructions: "",
      knowledgeContext: "",
    });
  };

  const startProjectChat = async (projectId: string) => {
    setBusy(`chat-${projectId}`);
    setError(null);
    try {
      const chat = await api.createSoloChat(token, { projectId });
      await onWorkspaceChanged();
      navigate(`/app/chats/${chat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project chat");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="projects-page">
      <div className="page-header">
        <h1>Projects</h1>
        <p>Define the persistent instructions and context SangamAI should load into every new chat inside a project.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="project-layout">
        <form
          className="project-form-panel"
          onSubmit={(event) => {
            event.preventDefault();
            const action = async () => {
              if (editingId) {
                await api.updateProject(token, editingId, form);
              } else {
                await api.createProject(token, form);
              }
              await loadProjects();
              resetForm();
            };

            setBusy("save-project");
            setError(null);
            void action()
              .catch((err: Error) => setError(err.message))
              .finally(() => setBusy(null));
          }}
        >
          <div className="solo-panel-header">
            <div>
              <p className="solo-panel-kicker">{editingId ? "Edit" : "Create"}</p>
              <h2>{editingId ? "Update project context" : "New project"}</h2>
            </div>
          </div>

          <div className="form-group">
            <label>Project name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="SangamAI, LeetCode Prep, Startup Planning..."
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Short overview of the project"
            />
          </div>

          <div className="form-group">
            <label>System instructions</label>
            <textarea
              value={form.systemInstructions}
              onChange={(event) =>
                setForm((current) => ({ ...current, systemInstructions: event.target.value }))
              }
              rows={7}
              placeholder="You are helping me build SangamAI. The backend is Spring Boot..."
            />
          </div>

          <div className="form-group">
            <label>Knowledge context</label>
            <textarea
              value={form.knowledgeContext}
              onChange={(event) =>
                setForm((current) => ({ ...current, knowledgeContext: event.target.value }))
              }
              rows={8}
              placeholder="Architecture notes, assumptions, design docs, glossary..."
            />
          </div>

          <div className="project-form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy === "save-project"}>
              {busy === "save-project" ? "Saving..." : editingId ? "Update Project" : "Create Project"}
            </button>
            {editingId && (
              <button className="btn btn-secondary" type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="project-list-panel">
          <div className="solo-panel-header">
            <div>
              <p className="solo-panel-kicker">Library</p>
              <h2>Your projects</h2>
            </div>
            <span>{projects.length} items</span>
          </div>

          {projects.length === 0 ? (
            <div className="solo-empty">
              <h3>No projects yet</h3>
              <p>Create your first project to persist context across all chats in that workspace.</p>
            </div>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <article key={project.id} className="project-card">
                  <div className="project-card-copy">
                    <h3>{project.name}</h3>
                    <p>{project.description || "No description"}</p>
                    <span>
                      {project.systemInstructions ? "Instructions saved" : "No instructions yet"}
                      {" • "}
                      {project.knowledgeContext ? "Knowledge attached" : "No knowledge yet"}
                    </span>
                  </div>
                  <div className="project-card-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => {
                        setEditingId(project.id);
                        setForm({
                          name: project.name,
                          description: project.description ?? "",
                          systemInstructions: project.systemInstructions,
                          knowledgeContext: project.knowledgeContext,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      disabled={busy === `chat-${project.id}`}
                      onClick={() => void startProjectChat(project.id)}
                    >
                      {busy === `chat-${project.id}` ? "Opening..." : "Start Chat"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

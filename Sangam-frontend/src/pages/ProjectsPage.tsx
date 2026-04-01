import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type {
  FriendUser,
  ProjectFileResponse,
  ProjectMemoryEntryResponse,
  ProjectMemberResponse,
  ProjectResponse,
  SessionListItem,
  SoloChatSummaryResponse,
} from "../types";

type ProjectType = "chooser" | "personal" | "group";
type BackingProjectType = "PERSONAL" | "GROUP";

type EditForm = {
  name: string;
  description: string;
  systemInstructions: string;
  knowledgeContext: string;
};

type SelectedCollaborator = FriendUser & {
  source: "friend" | "non-friend";
  sendFriendRequest?: boolean;
};

const HERO_COPY: Record<ProjectType, { title: string; description: string }> = {
  chooser: {
    title: "Projects that hold context around the real work",
    description:
      "Create a personal workspace for your own flow or a group project that turns the same context into a shared session space.",
  },
  personal: {
    title: "Personal projects for context that stays with you",
    description:
      "Build a persistent solo workspace where instructions, files, and memory stay attached to the work.",
  },
  group: {
    title: "Group projects for shared sessions, shared memory, and shared files",
    description:
      "Create a collaborative project, bring in people by username, and turn the project into a shared AI workspace with sessions instead of solo chats.",
  },
};

export default function ProjectsPage({
  token,
  onWorkspaceChanged,
}: {
  token: string;
  onWorkspaceChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [personalChats, setPersonalChats] = useState<SoloChatSummaryResponse[]>([]);
  const [groupSessions, setGroupSessions] = useState<SessionListItem[]>([]);
  const [selectedType, setSelectedType] = useState<ProjectType>("chooser");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [friendPrompt, setFriendPrompt] = useState<FriendUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    description: "",
    systemInstructions: "",
    knowledgeContext: "",
  });
  const [instructionDraft, setInstructionDraft] = useState("");
  const [memoryPrompt, setMemoryPrompt] = useState("");
  const [memoryEntries, setMemoryEntries] = useState<ProjectMemoryEntryResponse[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFileResponse[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendMatches, setFriendMatches] = useState<FriendUser[]>([]);
  const [directorySearchQuery, setDirectorySearchQuery] = useState("");
  const [directoryMatches, setDirectoryMatches] = useState<FriendUser[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<SelectedCollaborator[]>([]);

  const loadProjects = async () => {
    const data = await api.listProjects(token);
    setProjects(data);
  };

  const loadPersonalChats = async () => {
    const data = await api.listSoloChats(token);
    setPersonalChats(data);
  };

  const loadAll = async () => {
    await Promise.all([loadProjects(), loadPersonalChats()]);
  };

  useEffect(() => {
    loadAll().catch((err: Error) => setError(err.message));
  }, [token]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    if (!selectedProjectId) {
      setMemoryEntries([]);
      setProjectFiles([]);
      setGroupSessions([]);
      return;
    }

    Promise.all([
      api.listProjectMemoryEntries(token, selectedProjectId),
      api.listProjectFiles(token, selectedProjectId),
    ])
      .then(([memoryData, fileData]) => {
        setMemoryEntries(memoryData);
        setProjectFiles(fileData);
      })
      .catch((err: Error) => setError(err.message));
  }, [selectedProjectId, token]);

  useEffect(() => {
    if (!selectedProject?.environmentId || selectedProject.type !== "GROUP") {
      setGroupSessions([]);
      return;
    }

    api
      .listSessions(token, selectedProject.environmentId)
      .then(setGroupSessions)
      .catch((err: Error) => setError(err.message));
  }, [selectedProject?.environmentId, selectedProject?.type, token]);

  useEffect(() => {
    if (!creatingProject || selectedType !== "group") {
      setFriendMatches([]);
      setDirectoryMatches([]);
      return;
    }

    if (!friendSearchQuery.trim()) {
      setFriendMatches([]);
    } else {
      api.searchFriends(token, friendSearchQuery).then(setFriendMatches).catch(() => setFriendMatches([]));
    }

    if (!directorySearchQuery.trim()) {
      setDirectoryMatches([]);
    } else {
      api
        .searchUsers(token, directorySearchQuery, true)
        .then((users) => {
          const selectedIds = new Set(selectedCollaborators.map((user) => user.id));
          setDirectoryMatches(users.filter((user) => !selectedIds.has(user.id)));
        })
        .catch(() => setDirectoryMatches([]));
    }
  }, [creatingProject, directorySearchQuery, friendSearchQuery, selectedCollaborators, selectedType, token]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      const typeMatches =
        selectedType === "chooser" ? true : project.type === mapUiProjectType(selectedType);

      if (!typeMatches) return false;
      if (!query) return true;

      return (
        project.name.toLowerCase().includes(query) ||
        (project.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [projects, search, selectedType]);

  const projectPersonalChats = useMemo(() => {
    if (!selectedProject || selectedProject.type !== "PERSONAL") return [];
    return personalChats
      .filter((chat) => chat.projectId === selectedProject.id)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [personalChats, selectedProject]);

  const displayedMemory = useMemo(() => {
    if (!selectedProject) return "";
    const base = selectedProject.knowledgeContext?.trim()
      ? selectedProject.knowledgeContext.trim()
      : buildMemoryFallback(selectedProject);
    if (memoryEntries.length === 0) return base;

    return `${base}\n\nRemember / Forget updates\n${memoryEntries
      .map((entry) => `- ${entry.content}`)
      .join("\n")}`;
  }, [memoryEntries, selectedProject]);

  const openCreate = () => {
    if (selectedType === "chooser") {
      setError("Choose Personal Project or Group Project first.");
      return;
    }

    setError(null);
    setEditForm({
      name: "",
      description: "",
      systemInstructions: "",
      knowledgeContext: "",
    });
    setSelectedCollaborators([]);
    setFriendSearchQuery("");
    setDirectorySearchQuery("");
    setCreatingProject(true);
  };

  const openEditDetails = () => {
    if (!selectedProject) return;
    setEditForm({
      name: selectedProject.name,
      description: selectedProject.description ?? "",
      systemInstructions: selectedProject.systemInstructions,
      knowledgeContext: selectedProject.knowledgeContext,
    });
    setEditOpen(true);
    setMenuOpen(false);
  };

  const saveProject = async (mode: "create" | "edit") => {
    setBusyKey(mode === "create" ? "create-project" : "edit-project");
    setError(null);

    try {
      if (mode === "create") {
        const projectType = mapUiProjectType(selectedType);
        const created = await api.createProject(token, {
          ...editForm,
          type: projectType,
          memberUsernames:
            projectType === "GROUP"
              ? selectedCollaborators.map((member) => member.username)
              : [],
        });

        const friendRequestsToSend = selectedCollaborators
          .filter((member) => member.source === "non-friend" && member.sendFriendRequest)
          .map((member) => member.username);

        if (friendRequestsToSend.length > 0) {
          await Promise.allSettled(
            friendRequestsToSend.map((username) => api.sendFriendRequest(token, username)),
          );
        }

        setProjects((current) => [created, ...current]);
        setSelectedProjectId(created.id);
        setCreatingProject(false);
      } else if (selectedProject) {
        const updated = await api.updateProject(token, selectedProject.id, {
          ...editForm,
          type: selectedProject.type,
          memberUsernames: selectedProject.members.map((member) => member.username),
        });
        setProjects((current) =>
          current.map((project) => (project.id === updated.id ? updated : project)),
        );
        setEditOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save project");
    } finally {
      setBusyKey(null);
    }
  };

  const saveInstructions = async () => {
    if (!selectedProject) return;
    setBusyKey("save-instructions");
    setError(null);
    try {
      const updated = await api.updateProject(token, selectedProject.id, {
        name: selectedProject.name,
        description: selectedProject.description ?? "",
        type: selectedProject.type,
        systemInstructions: instructionDraft,
        knowledgeContext: selectedProject.knowledgeContext,
        memberUsernames: selectedProject.members.map((member) => member.username),
      });
      setProjects((current) =>
        current.map((project) => (project.id === updated.id ? updated : project)),
      );
      setInstructionsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save instructions");
    } finally {
      setBusyKey(null);
    }
  };

  const submitMemoryNote = async () => {
    if (!selectedProject || !memoryPrompt.trim()) return;
    setBusyKey("save-memory");
    setError(null);
    try {
      const created = await api.addProjectMemoryEntry(token, selectedProject.id, memoryPrompt.trim());
      setMemoryEntries((current) => [created, ...current]);
      setMemoryPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save memory note");
    } finally {
      setBusyKey(null);
    }
  };

  const startProjectChat = async () => {
    if (!selectedProject) return;
    setBusyKey("start-project-chat");
    setError(null);
    try {
      const chat = await api.createSoloChat(token, { projectId: selectedProject.id });
      await loadPersonalChats();
      await onWorkspaceChanged();
      navigate(`/app/chats/${chat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start project chat");
    } finally {
      setBusyKey(null);
    }
  };

  const startProjectSession = async () => {
    if (!selectedProject?.environmentId) return;
    setBusyKey("start-project-session");
    setError(null);
    try {
      const created = await api.createSession(
        token,
        selectedProject.environmentId,
        selectedProject.name,
      );
      const sessions = await api.listSessions(token, selectedProject.environmentId);
      setGroupSessions(sessions);
      navigate(`/app/environments/${selectedProject.environmentId}/sessions/${created.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create session");
    } finally {
      setBusyKey(null);
    }
  };

  const deleteProject = async () => {
    if (!selectedProject) return;
    setBusyKey("delete-project");
    setError(null);
    try {
      await api.deleteProject(token, selectedProject.id);
      setProjects((current) => current.filter((project) => project.id !== selectedProject.id));
      setPersonalChats((current) =>
        current.map((chat) =>
          chat.projectId === selectedProject.id
            ? { ...chat, projectId: null, projectName: null }
            : chat,
        ),
      );
      setDeleteOpen(false);
      setSelectedProjectId(null);
      await onWorkspaceChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete project");
    } finally {
      setBusyKey(null);
    }
  };

  const handleFilesPicked = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject) return;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setBusyKey("upload-files");
    setError(null);
    try {
      const uploaded = await api.uploadProjectFiles(token, selectedProject.id, files);
      setProjectFiles((current) => [...uploaded, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload files");
    } finally {
      event.target.value = "";
      setBusyKey(null);
    }
  };

  const removeFile = async (fileId: string) => {
    if (!selectedProject) return;
    setBusyKey(`delete-file-${fileId}`);
    setError(null);
    try {
      await api.deleteProjectFile(token, selectedProject.id, fileId);
      setProjectFiles((current) => current.filter((file) => file.id !== fileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete file");
    } finally {
      setBusyKey(null);
    }
  };

  const addFriendCollaborator = (user: FriendUser) => {
    setSelectedCollaborators((current) => {
      if (current.some((item) => item.id === user.id)) return current;
      return [...current, { ...user, source: "friend" }];
    });
  };

  const addDirectoryCollaborator = (user: FriendUser) => {
    if (selectedCollaborators.some((item) => item.id === user.id)) return;
    setFriendPrompt(user);
  };

  const confirmDirectoryCollaborator = (sendFriendRequest: boolean) => {
    if (!friendPrompt) return;
    setSelectedCollaborators((current) => [
      ...current,
      {
        ...friendPrompt,
        source: "non-friend",
        sendFriendRequest,
      },
    ]);
    setFriendPrompt(null);
  };

  const removeCollaborator = (userId: string) => {
    setSelectedCollaborators((current) => current.filter((item) => item.id !== userId));
  };

  if (creatingProject) {
    const isGroup = selectedType === "group";

    return (
      <div className="project-creation-page">
        {error && <div className="error-banner">{error}</div>}

        <div className={`project-creation-shell ${isGroup ? "group" : ""}`}>
          <div className="project-creation-copy">
            <h1>{isGroup ? "Create a group project" : "Create a personal project"}</h1>
            <p>
              {isGroup
                ? "Add the core project details first, then choose collaborators from your friends or from the broader directory."
                : "Start with the essentials. Instructions, memory, and files can be added after the project is created."}
            </p>
          </div>

          <div className="project-creation-form">
            <div className="form-group">
              <label>Name</label>
              <input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, name: event.target.value }))
                }
                className="dialog-input project-creation-input"
                placeholder="Name your project"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, description: event.target.value }))
                }
                className="dialog-input project-creation-textarea"
                rows={4}
                placeholder="Describe your project, goals, subject, etc..."
              />
            </div>

            {isGroup && (
              <div className="group-project-builder">
                <div className="group-project-search-card">
                  <div className="group-project-search-head">
                    <h3>Add from friends</h3>
                    <span>Search people from your existing network.</span>
                  </div>
                  <input
                    value={friendSearchQuery}
                    onChange={(event) => setFriendSearchQuery(event.target.value)}
                    className="dialog-input"
                    placeholder="Search friends by username"
                  />
                  <div className="group-project-match-list">
                    {friendMatches.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="group-project-match"
                        onClick={() => addFriendCollaborator(user)}
                      >
                        <MemberAvatar member={user} />
                        <div>
                          <strong>{user.displayName}</strong>
                          <span>@{user.username}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="group-project-search-card">
                  <div className="group-project-search-head">
                    <h3>Add from people outside your friends list</h3>
                    <span>Select anyone by username. You can invite them into the project and optionally send a friend request too.</span>
                  </div>
                  <input
                    value={directorySearchQuery}
                    onChange={(event) => setDirectorySearchQuery(event.target.value)}
                    className="dialog-input"
                    placeholder="Search by username"
                  />
                  <div className="group-project-match-list">
                    {directoryMatches.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="group-project-match"
                        onClick={() => addDirectoryCollaborator(user)}
                      >
                        <MemberAvatar member={user} />
                        <div>
                          <strong>{user.displayName}</strong>
                          <span>@{user.username}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="group-project-members-card">
                  <h3>Selected collaborators</h3>
                  <p>
                    {selectedCollaborators.length === 0
                      ? "No collaborators selected yet."
                      : `${selectedCollaborators.length} collaborator${selectedCollaborators.length === 1 ? "" : "s"} selected.`}
                  </p>
                  <div className="group-project-selected-list">
                    {selectedCollaborators.map((member) => (
                      <div key={member.id} className="group-project-selected-row">
                        <div className="group-project-selected-copy">
                          <MemberAvatar member={member} />
                          <div>
                            <strong>{member.displayName}</strong>
                            <span>
                              @{member.username}
                              {member.source === "non-friend" && member.sendFriendRequest
                                ? " • friend request queued"
                                : member.source === "non-friend"
                                  ? " • added without friend request"
                                  : " • friend"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => removeCollaborator(member.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="project-creation-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setCreatingProject(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={
                  busyKey === "create-project" ||
                  !editForm.name.trim() ||
                  (isGroup && selectedCollaborators.length === 0)
                }
                onClick={() => void saveProject("create")}
              >
                {busyKey === "create-project" ? "Creating..." : "Create project"}
              </button>
            </div>
          </div>
        </div>

        {friendPrompt && (
          <ProjectDialog
            title="Also add as a friend?"
            subtitle={`@${friendPrompt.username} will be added to the project either way. Do you also want to send them a friend request?`}
            onClose={() => setFriendPrompt(null)}
            onSubmit={() => confirmDirectoryCollaborator(true)}
            submitLabel="Yes, send request"
          >
            <div className="project-collaborator-prompt">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => confirmDirectoryCollaborator(false)}
              >
                No, just add to project
              </button>
            </div>
          </ProjectDialog>
        )}
      </div>
    );
  }

  if (selectedProject) {
    const isGroupProject = selectedProject.type === "GROUP";
    return (
      <div className="project-detail-page">
        {error && <div className="error-banner">{error}</div>}

        <button
          type="button"
          className="project-back-link"
          onClick={() => {
            setSelectedProjectId(null);
            setMenuOpen(false);
          }}
        >
          ← All projects
        </button>

        <div className="project-detail-shell">
          <section className="project-detail-main">
            <div className="project-detail-head">
              <div>
                <div className="project-detail-type-row">
                  <span className={`project-type-badge ${isGroupProject ? "group" : "personal"}`}>
                    {isGroupProject ? "Group Project" : "Personal Project"}
                  </span>
                </div>
                <h1>{selectedProject.name}</h1>
                <p className="project-detail-description">
                  {selectedProject.description || "Add a short overview so every workspace in this project starts from the right frame."}
                </p>
              </div>
              <div className="project-detail-actions">
                <button
                  type="button"
                  className="project-menu-trigger"
                  aria-label="Project menu"
                  onClick={() => setMenuOpen((current) => !current)}
                >
                  ⋮
                </button>
                {menuOpen && (
                  <div className="project-menu">
                    <button type="button" onClick={openEditDetails}>
                      Edit details
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setDeleteOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="project-new-chat-box"
              onClick={() =>
                void (isGroupProject ? startProjectSession() : startProjectChat())
              }
              disabled={busyKey === (isGroupProject ? "start-project-session" : "start-project-chat")}
            >
              <span className="project-new-chat-placeholder">
                {isGroupProject ? "Start a shared session for this project" : "How can I help you today?"}
              </span>
              <div className="project-new-chat-footer">
                <span className="project-new-chat-plus">+</span>
                <span>
                  {isGroupProject
                    ? busyKey === "start-project-session"
                      ? "Opening session..."
                      : "Create a new session in this project"
                    : busyKey === "start-project-chat"
                      ? "Opening project chat..."
                      : "Start a new chat in this project"}
                </span>
              </div>
            </button>

            <div className="project-chat-list">
              {!isGroupProject ? (
                projectPersonalChats.length === 0 ? (
                  <div className="project-chat-empty">
                    <h3>No project chats yet</h3>
                    <p>Create the first chat and SangamAI will carry this project’s context into it automatically.</p>
                  </div>
                ) : (
                  projectPersonalChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      className="project-chat-item"
                      onClick={() => navigate(`/app/chats/${chat.id}`)}
                    >
                      <strong>{chat.title}</strong>
                      <span>Last message {relativeTime(chat.updatedAt)}</span>
                    </button>
                  ))
                )
              ) : groupSessions.length === 0 ? (
                <div className="project-chat-empty">
                  <h3>No sessions yet</h3>
                  <p>Create the first shared session and everyone in the group project can continue from the same context.</p>
                </div>
              ) : (
                groupSessions.map((session) => (
                  <button
                    key={session.sessionId}
                    type="button"
                    className="project-chat-item"
                    onClick={() =>
                      navigate(`/app/environments/${selectedProject.environmentId}/sessions/${session.sessionId}`)
                    }
                  >
                    <strong>{session.title || "Untitled session"}</strong>
                    <span>{session.createdBy} • {relativeTime(session.createdAt)}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          <aside className="project-detail-sidebar">
            {isGroupProject && (
              <section className="project-side-card">
                <div className="project-side-card-head">
                  <div>
                    <h3>Collaborators</h3>
                    <span>Everyone included in this group project workspace.</span>
                  </div>
                </div>
                <div className="project-collaborator-list">
                  {selectedProject.members.map((member) => (
                    <div key={member.userId} className="project-collaborator-row">
                      <MemberAvatar member={member} />
                      <div>
                        <strong>{member.displayName}</strong>
                        <span>@{member.username} • {member.role === "OWNER" ? "Owner" : "Member"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="project-side-card">
              <div className="project-side-card-head">
                <div>
                  <h3>Memory</h3>
                  <span>Purpose &amp; context that frames every {isGroupProject ? "session" : "chat"} in this project.</span>
                </div>
                <button type="button" className="project-side-icon" onClick={() => setMemoryOpen(true)}>
                  ✎
                </button>
              </div>
              <div className="project-side-badge">{isGroupProject ? "Shared" : "Only you"}</div>
              <p className="project-side-preview">{truncate(displayedMemory, 165)}</p>
            </section>

            <section className="project-side-card">
              <div className="project-side-card-head">
                <div>
                  <h3>Instructions</h3>
                  <span>Add instructions to tailor responses inside this project.</span>
                </div>
                <button
                  type="button"
                  className="project-side-icon"
                  onClick={() => {
                    setInstructionDraft(selectedProject.systemInstructions);
                    setInstructionsOpen(true);
                  }}
                >
                  +
                </button>
              </div>
              <p className="project-side-preview">
                {selectedProject.systemInstructions
                  ? truncate(selectedProject.systemInstructions, 160)
                  : "No project instructions yet."}
              </p>
            </section>

            <section className="project-side-card">
              <div className="project-side-card-head">
                <div>
                  <h3>Files</h3>
                  <span>Uploaded files are stored on the backend and indexed when SangamAI can read their text.</span>
                </div>
                <button
                  type="button"
                  className="project-side-icon"
                  onClick={() => fileInputRef.current?.click()}
                >
                  +
                </button>
              </div>
              <input
                ref={fileInputRef}
                hidden
                multiple
                type="file"
                onChange={handleFilesPicked}
              />
              {projectFiles.length === 0 ? (
                <p className="project-side-preview">No files attached yet.</p>
              ) : (
                <div className="project-files-grid">
                  {projectFiles.map((file) => (
                    <div key={file.id} className="project-file-card">
                      <div className="project-file-card-head">
                        <strong>{file.name}</strong>
                        <button
                          type="button"
                          className="project-file-remove"
                          onClick={() => void removeFile(file.id)}
                          disabled={busyKey === `delete-file-${file.id}`}
                        >
                          ×
                        </button>
                      </div>
                      <span>{formatFileSize(file.sizeBytes)}</span>
                      <em>{file.indexedForPrompt ? "Indexed" : "Stored only"}</em>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>

        {editOpen && (
          <ProjectDialog
            title="Edit project details"
            subtitle="Update the name and description for this project."
            onClose={() => setEditOpen(false)}
            onSubmit={() => void saveProject("edit")}
            submitLabel={busyKey === "edit-project" ? "Saving..." : "Save changes"}
          >
            <div className="form-group">
              <label>Project name</label>
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                className="dialog-input"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={editForm.description}
                onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                className="dialog-input project-dialog-textarea"
                rows={4}
              />
            </div>
          </ProjectDialog>
        )}

        {memoryOpen && (
          <ProjectDialog
            title="Manage project memory"
            subtitle="Treat this like a living project brief. Review the current memory and tell SangamAI what to remember or forget."
            onClose={() => setMemoryOpen(false)}
            onSubmit={() => {
              void submitMemoryNote();
            }}
            submitLabel={busyKey === "save-memory" ? "Saving..." : "Remember this"}
          >
            <div className="project-memory-sheet">
              <div className="project-memory-body">
                <div className="project-memory-markdown">
                  {displayedMemory.split("\n").map((line, index) => (
                    <p key={index}>{line || "\u00A0"}</p>
                  ))}
                </div>
              </div>
              <div className="project-memory-composer">
                <input
                  value={memoryPrompt}
                  onChange={(event) => setMemoryPrompt(event.target.value)}
                  className="dialog-input"
                  placeholder="Tell SangamAI what to remember or forget..."
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void submitMemoryNote()}
                  disabled={busyKey === "save-memory"}
                >
                  →
                </button>
              </div>
              {memoryEntries.length > 0 && (
                <div className="project-memory-history">
                  {memoryEntries.map((entry) => (
                    <div key={entry.id} className="project-memory-history-item">
                      <strong>{relativeTime(entry.createdAt)}</strong>
                      <span>{entry.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ProjectDialog>
        )}

        {instructionsOpen && (
          <ProjectDialog
            title="Set project instructions"
            subtitle="Provide SangamAI with instructions and information for work inside this project."
            onClose={() => setInstructionsOpen(false)}
            onSubmit={() => void saveInstructions()}
            submitLabel={busyKey === "save-instructions" ? "Saving..." : "Save instructions"}
          >
            <textarea
              value={instructionDraft}
              onChange={(event) => setInstructionDraft(event.target.value)}
              className="dialog-input project-instructions-input"
              rows={12}
              placeholder="Think step by step and stay specific."
            />
          </ProjectDialog>
        )}

        {deleteOpen && (
          <ProjectDialog
            title="Delete project"
            subtitle="This removes the project workspace. Personal chats stay in your history but lose the project attachment."
            onClose={() => setDeleteOpen(false)}
            onSubmit={() => void deleteProject()}
            submitLabel={busyKey === "delete-project" ? "Deleting..." : "Delete project"}
            danger
          >
            <p className="project-delete-copy">
              Delete <strong>{selectedProject.name}</strong>?
            </p>
          </ProjectDialog>
        )}
      </div>
    );
  }

  return (
    <div className="projects-hub">
      {error && <div className="error-banner">{error}</div>}

      <section className="projects-hero">
        <div className="projects-hero-copy">
          <h1>{HERO_COPY[selectedType].title}</h1>
          <p>{HERO_COPY[selectedType].description}</p>
        </div>

        <div className="projects-type-row">
          <button type="button" className="projects-primary-pill" onClick={() => setSelectedType("chooser")}>
            Choose type
          </button>
          <div className="projects-type-switcher">
            <button
              type="button"
              className={`projects-type-chip ${selectedType === "chooser" ? "active" : ""}`}
              onClick={() => setSelectedType("chooser")}
            >
              Choose project
            </button>
            <button
              type="button"
              className={`projects-type-chip ${selectedType === "personal" ? "active" : ""}`}
              onClick={() => setSelectedType("personal")}
            >
              Personal Project
            </button>
            <button
              type="button"
              className={`projects-type-chip ${selectedType === "group" ? "active" : ""}`}
              onClick={() => setSelectedType("group")}
            >
              Group Project
            </button>
          </div>
          <button type="button" className="projects-create-pill" onClick={openCreate}>
            Create Project
          </button>
        </div>
      </section>

      <section className="projects-library">
        <div className="projects-search-shell">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="projects-search"
            placeholder="Search your projects"
          />
        </div>

        <div className="projects-library-head">
          <div>
            <h2>Your projects</h2>
            <p>Personal projects give you private chats. Group projects turn the same shared context into collaborative sessions.</p>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="projects-empty">
            <h3>No projects yet</h3>
            <p>Create a personal or group project to keep context, instructions, memory, and files attached to a real workspace.</p>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="projects-grid-card"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <div className="projects-grid-card-head">
                  <span className={`project-type-badge ${project.type === "GROUP" ? "group" : "personal"}`}>
                    {project.type === "GROUP" ? "Group Project" : "Personal Project"}
                  </span>
                  <span className="projects-grid-meta">{relativeTime(project.updatedAt)}</span>
                </div>
                <h3>{project.name}</h3>
                <p>{project.description || "No description yet."}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectDialog({
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
  submitLabel,
  danger = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card project-dialog-card" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head project-dialog-head">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="project-dialog-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dialog-body project-dialog-body">{children}</div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? "dialog-danger" : "btn-primary"}`}
            type="button"
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberAvatar({ member }: { member: FriendUser | ProjectMemberResponse }) {
  if (member.hasAvatar) {
    return (
      <img
        className="group-project-avatar"
        src={api.getUserAvatarUrl("userId" in member ? member.userId : member.id, member.updatedAt)}
        alt={`${member.displayName} avatar`}
      />
    );
  }

  return <div className="group-project-avatar fallback">{member.displayName.charAt(0).toUpperCase()}</div>;
}

function truncate(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit)}...`;
}

function buildMemoryFallback(project: ProjectResponse) {
  const lines = [
    "Purpose & context",
    `${project.name} is an active ${project.type === "GROUP" ? "group" : "personal"} project in SangamAI.`,
  ];

  if (project.description) {
    lines.push("", project.description);
  }

  if (project.systemInstructions) {
    lines.push("", "Instructions snapshot", project.systemInstructions);
  }

  return lines.join("\n");
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function mapUiProjectType(projectType: ProjectType): BackingProjectType {
  return projectType === "group" ? "GROUP" : "PERSONAL";
}

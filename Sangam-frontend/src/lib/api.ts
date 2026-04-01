import type {
  ApiResponse,
  AuthResponse,
  CentrifugoConnectionToken,
  CurrentUser,
  EnvironmentResponse,
  FriendRequestResponse,
  FriendsOverviewResponse,
  FriendUser,
  MemberResponse,
  ProjectFileResponse,
  ProjectMemoryEntryResponse,
  ProjectMemberResponse,
  ProfileUpdateResponse,
  ProjectResponse,
  SessionListItem,
  SessionSnapshotDto,
  SoloChatDetailResponse,
  SoloChatSummaryResponse,
  UserProfileResponse,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Content-Type") && options.body) {
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!isFormData) {
      headers.set("Content-Type", "application/json");
    }
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message ?? "Request failed");
  }

  return payload.data as T;
}

export const api = {
  baseUrl: API_BASE_URL,

  getUserAvatarUrl(userId: string, updatedAt?: string) {
    const version = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
    return `${API_BASE_URL}/api/users/${userId}/avatar${version}`;
  },

  register(body: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }) {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  login(body: { email: string; password: string }) {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getMe(token: string) {
    return request<CurrentUser>("/api/users/me", {}, token);
  },

  updateDisplayName(token: string, displayName: string) {
    return request<CurrentUser>(
      "/api/users/me/display-name",
      {
        method: "PATCH",
        body: JSON.stringify({ displayName }),
      },
      token,
    );
  },

  updateUsername(token: string, username: string) {
    return request<ProfileUpdateResponse>(
      "/api/users/me/username",
      {
        method: "PATCH",
        body: JSON.stringify({ username }),
      },
      token,
    );
  },

  updateAppearancePreference(
    token: string,
    appearancePreference: "LIGHT" | "DARK" | "SYSTEM",
  ) {
    return request<CurrentUser>(
      "/api/users/me/appearance",
      {
        method: "PATCH",
        body: JSON.stringify({ appearancePreference }),
      },
      token,
    );
  },

  uploadAvatar(token: string, avatar: File) {
    const formData = new FormData();
    formData.append("avatar", avatar);
    return request<CurrentUser>(
      "/api/users/me/avatar",
      {
        method: "POST",
        body: formData,
      },
      token,
    );
  },

  removeAvatar(token: string) {
    return request<CurrentUser>(
      "/api/users/me/avatar",
      {
        method: "DELETE",
      },
      token,
    );
  },

  deleteAccount(token: string, confirmationText: string) {
    return request<null>(
      "/api/users/me",
      {
        method: "DELETE",
        body: JSON.stringify({ confirmationText }),
      },
      token,
    );
  },

  listProjects(token: string) {
    return request<ProjectResponse[]>("/api/workspace/projects", {}, token);
  },

  createProject(
    token: string,
    body: {
      name: string;
      description: string;
      type?: "PERSONAL" | "GROUP";
      systemInstructions: string;
      knowledgeContext: string;
      memberUsernames?: string[];
    },
  ) {
    return request<ProjectResponse>(
      "/api/workspace/projects",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token,
    );
  },

  updateProject(
    token: string,
    projectId: string,
    body: {
      name: string;
      description: string;
      type?: "PERSONAL" | "GROUP";
      systemInstructions: string;
      knowledgeContext: string;
      memberUsernames?: string[];
    },
  ) {
    return request<ProjectResponse>(
      `/api/workspace/projects/${projectId}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
      token,
    );
  },

  deleteProject(token: string, projectId: string) {
    return request<null>(
      `/api/workspace/projects/${projectId}`,
      {
        method: "DELETE",
      },
      token,
    );
  },

  listProjectMemoryEntries(token: string, projectId: string) {
    return request<ProjectMemoryEntryResponse[]>(
      `/api/workspace/projects/${projectId}/memory`,
      {},
      token,
    );
  },

  listProjectMembers(token: string, projectId: string) {
    return request<ProjectMemberResponse[]>(
      `/api/workspace/projects/${projectId}/members`,
      {},
      token,
    );
  },

  addProjectMemoryEntry(token: string, projectId: string, content: string) {
    return request<ProjectMemoryEntryResponse>(
      `/api/workspace/projects/${projectId}/memory`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
      token,
    );
  },

  listProjectFiles(token: string, projectId: string) {
    return request<ProjectFileResponse[]>(
      `/api/workspace/projects/${projectId}/files`,
      {},
      token,
    );
  },

  uploadProjectFiles(token: string, projectId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return request<ProjectFileResponse[]>(
      `/api/workspace/projects/${projectId}/files`,
      {
        method: "POST",
        body: formData,
      },
      token,
    );
  },

  deleteProjectFile(token: string, projectId: string, fileId: string) {
    return request<null>(
      `/api/workspace/projects/${projectId}/files/${fileId}`,
      {
        method: "DELETE",
      },
      token,
    );
  },

  listSoloChats(token: string) {
    return request<SoloChatSummaryResponse[]>("/api/workspace/chats", {}, token);
  },

  listRecentSoloChats(token: string, limit = 10) {
    return request<SoloChatSummaryResponse[]>(
      `/api/workspace/chats/recent?limit=${limit}`,
      {},
      token,
    );
  },

  createSoloChat(
    token: string,
    body: { title?: string; projectId?: string | null } = {},
  ) {
    return request<SoloChatDetailResponse>(
      "/api/workspace/chats",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token,
    );
  },

  getSoloChat(token: string, chatId: string) {
    return request<SoloChatDetailResponse>(
      `/api/workspace/chats/${chatId}`,
      {},
      token,
    );
  },

  updateSoloChat(
    token: string,
    chatId: string,
    body: { title?: string; projectId?: string | null; pinned?: boolean },
  ) {
    return request<SoloChatDetailResponse>(
      `/api/workspace/chats/${chatId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
      token,
    );
  },

  deleteSoloChat(token: string, chatId: string) {
    return request<null>(
      `/api/workspace/chats/${chatId}`,
      {
        method: "DELETE",
      },
      token,
    );
  },

  sendSoloMessage(token: string, chatId: string, content: string) {
    return request<SoloChatDetailResponse>(
      `/api/workspace/chats/${chatId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
      token,
    );
  },

  listEnvironments(token: string) {
    return request<EnvironmentResponse[]>("/api/environments", {}, token);
  },

  getFriendsOverview(token: string) {
    return request<FriendsOverviewResponse>("/api/friends", {}, token);
  },

  searchFriends(token: string, query: string) {
    return request<FriendUser[]>(
      `/api/friends/search?query=${encodeURIComponent(query)}`,
      {},
      token,
    );
  },

  sendFriendRequest(token: string, username: string) {
    return request<FriendRequestResponse>(
      "/api/friends/requests",
      {
        method: "POST",
        body: JSON.stringify({ username }),
      },
      token,
    );
  },

  acceptFriendRequest(token: string, requestId: string) {
    return request<FriendUser>(`/api/friends/requests/${requestId}/accept`, { method: "POST" }, token);
  },

  removeFriendRequest(token: string, requestId: string, direction: "incoming" | "outgoing") {
    return request<null>(
      `/api/friends/requests/${requestId}?direction=${direction}`,
      { method: "DELETE" },
      token,
    );
  },

  removeFriend(token: string, userId: string) {
    return request<null>(`/api/friends/${userId}`, { method: "DELETE" }, token);
  },

  getUserProfile(token: string, username: string) {
    return request<UserProfileResponse>(
      `/api/users/username/${encodeURIComponent(username)}/profile`,
      {},
      token,
    );
  },

  searchUsers(token: string, query: string, excludeFriends = false) {
    return request<FriendUser[]>(
      `/api/users/search?query=${encodeURIComponent(query)}&excludeFriends=${excludeFriends}`,
      {},
      token,
    );
  },

  createEnvironment(
    token: string,
    body: { name: string; description: string },
  ) {
    return request<EnvironmentResponse>(
      "/api/environments",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token,
    );
  },

  joinEnvironment(token: string, inviteCode: string) {
    return request<EnvironmentResponse>(
      `/api/environments/join/${inviteCode}`,
      {
        method: "POST",
      },
      token,
    );
  },

  getMembers(token: string, environmentId: string) {
    return request<MemberResponse[]>(
      `/api/environments/${environmentId}/members`,
      {},
      token,
    );
  },

  addMember(token: string, environmentId: string, username: string) {
    return request<MemberResponse>(
      `/api/environments/${environmentId}/members`,
      {
        method: "POST",
        body: JSON.stringify({ username }),
      },
      token,
    );
  },

  updateMemberRole(
    token: string,
    environmentId: string,
    username: string,
    role: "CO_HOST" | "MEMBER",
  ) {
    return request<MemberResponse>(
      `/api/environments/${environmentId}/members/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ username, role }),
      },
      token,
    );
  },

  updatePermission(
    token: string,
    environmentId: string,
    username: string,
    canInteractWithAi: boolean,
  ) {
    return request<MemberResponse>(
      `/api/environments/${environmentId}/members/permissions`,
      {
        method: "PATCH",
        body: JSON.stringify({ username, canInteractWithAi }),
      },
      token,
    );
  },

  createSession(token: string, environmentId: string, title: string) {
    return request<{ sessionId: string; title: string; status: string }>(
      `/api/environments/${environmentId}/sessions`,
      {
        method: "POST",
        body: JSON.stringify({ title }),
      },
      token,
    );
  },

  listSessions(token: string, environmentId: string) {
    return request<SessionListItem[]>(
      `/api/environments/${environmentId}/sessions`,
      {},
      token,
    );
  },

  askRoot(token: string, sessionId: string, question: string) {
    return request<{ nodeId: string }>(
      `/api/sessions/${sessionId}/ask`,
      {
        method: "POST",
        body: JSON.stringify({ question }),
      },
      token,
    );
  },

  getSnapshot(token: string, sessionId: string) {
    return request<SessionSnapshotDto>(
      `/api/sessions/${sessionId}/snapshot`,
      {},
      token,
    );
  },

  askOnParagraph(
    token: string,
    nodeId: string,
    paragraphId: string,
    question: string,
  ) {
    return request<{ nodeId: string }>(
      `/api/nodes/${nodeId}/paragraphs/${paragraphId}/ask`,
      {
        method: "POST",
        body: JSON.stringify({ question }),
      },
      token,
    );
  },

  askOnBlock(
    token: string,
    nodeId: string,
    blockIndex: number,
    question: string,
  ) {
    return request<{ nodeId: string; paragraphId: string; blockIndex: number }>(
      `/api/nodes/${nodeId}/blocks/${blockIndex}/ask`,
      {
        method: "POST",
        body: JSON.stringify({ question }),
      },
      token,
    );
  },

  getCentrifugoToken(token: string) {
    return request<CentrifugoConnectionToken>(
      "/api/centrifugo/token",
      {},
      token,
    );
  },

  getSubscriptionToken(token: string, channel: string) {
    return request<{ token: string }>(
      `/api/centrifugo/token/subscription?channel=${encodeURIComponent(channel)}`,
      {},
      token,
    );
  },
};

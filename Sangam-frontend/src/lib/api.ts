import type {
  ApiResponse,
  AuthResponse,
  CentrifugoConnectionToken,
  CurrentUser,
  EnvironmentResponse,
  MemberResponse,
  SessionListItem,
  SessionSnapshotDto,
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
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.message ?? "Request failed");
  }

  return payload.data;
}

export const api = {
  baseUrl: API_BASE_URL,

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

  listEnvironments(token: string) {
    return request<EnvironmentResponse[]>("/api/environments", {}, token);
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

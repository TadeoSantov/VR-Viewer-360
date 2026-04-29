export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ─── Auth token helpers ───────────────────────────────────────────────────────

const TOKEN_KEY = "vr_auth_token";

export const tokenStore = {
  get: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null,
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// ─── Base request (automatically attaches Bearer token) ──────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    // Auto-logout on 401
    if (res.status === 401) tokenStore.clear();
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  username: string;
  email: string;
}

export interface Project {
  id: string;
  userId?: string;
  name: string;
  slug: string;
  description: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface Scene {
  id: string;
  projectId: string;
  name: string;
  assetId?: string;
  assetFilename?: string;
  thumbnailPath?: string;
  cubemapDir?: string;
  initialYaw: number;
  initialPitch: number;
  initialFov: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SceneListResponse {
  scenes: Scene[];
  total: number;
}

export interface Hotspot {
  id: string;
  projectId: string;
  sceneId: string;
  label: string;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  targetSceneId?: string;
  type: "info" | "navigation";
  createdAt: string;
  updatedAt: string;
}

export interface HotspotListResponse {
  hotspots: Hotspot[];
  total: number;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { username: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => request<AuthUser>("/api/auth/me"),
};

// ─── Projects API ─────────────────────────────────────────────────────────────

export const api = {
  projects: {
    list: () => request<ProjectListResponse>("/api/projects"),

    get: (id: string) => request<Project>(`/api/projects/${id}`),

    create: (data: { name: string; description?: string }) =>
      request<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: { name?: string; description?: string }) =>
      request<Project>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      request<void>(`/api/projects/${id}`, { method: "DELETE" }),

    publish: (id: string) =>
      request<Project>(`/api/projects/${id}/publish`, { method: "POST" }),

    unpublish: (id: string) =>
      request<Project>(`/api/projects/${id}/unpublish`, { method: "POST" }),
  },

  scenes: {
    list: (projectId: string) =>
      request<SceneListResponse>(`/api/projects/${projectId}/scenes`),

    get: (projectId: string, sceneId: string) =>
      request<Scene>(`/api/projects/${projectId}/scenes/${sceneId}`),

    upload: async (projectId: string, file: File, name?: string): Promise<Scene> => {
      const formData = new FormData();
      formData.append("file", file);
      if (name) formData.append("name", name);

      const headers: Record<string, string> = {};
      const token = tokenStore.get();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/projects/${projectId}/upload-scene`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || "Upload failed");
      }
      return res.json();
    },

    update: (projectId: string, sceneId: string, data: Record<string, unknown>) =>
      request<Scene>(`/api/projects/${projectId}/scenes/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (projectId: string, sceneId: string) =>
      request<void>(`/api/projects/${projectId}/scenes/${sceneId}`, {
        method: "DELETE",
      }),
  },

  hotspots: {
    list: (projectId: string, sceneId: string) =>
      request<HotspotListResponse>(
        `/api/projects/${projectId}/scenes/${sceneId}/hotspots`
      ),

    create: (
      projectId: string,
      sceneId: string,
      data: {
        label: string;
        description?: string;
        positionX: number;
        positionY: number;
        positionZ: number;
        targetSceneId?: string;
        type?: string;
      }
    ) =>
      request<Hotspot>(
        `/api/projects/${projectId}/scenes/${sceneId}/hotspots`,
        { method: "POST", body: JSON.stringify(data) }
      ),

    update: (
      projectId: string,
      sceneId: string,
      hotspotId: string,
      data: Record<string, unknown>
    ) =>
      request<Hotspot>(
        `/api/projects/${projectId}/scenes/${sceneId}/hotspots/${hotspotId}`,
        { method: "PATCH", body: JSON.stringify(data) }
      ),

    delete: (projectId: string, sceneId: string, hotspotId: string) =>
      request<void>(
        `/api/projects/${projectId}/scenes/${sceneId}/hotspots/${hotspotId}`,
        { method: "DELETE" }
      ),
  },
};

// ─── Public tour ──────────────────────────────────────────────────────────────

export interface PublicTourScene extends Scene {
  hotspots: Hotspot[];
}

export interface PublicTourResponse {
  project: Project;
  scenes: PublicTourScene[];
}

export const publicApi = {
  getTour: (slug: string) => request<PublicTourResponse>(`/api/tours/${slug}`),
};

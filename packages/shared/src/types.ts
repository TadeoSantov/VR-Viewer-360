// Shared types between frontend and API contracts

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  projectId: string;
  name: string;
  assetId?: string;
  assetUrl?: string;
  initialYaw: number;
  initialPitch: number;
  initialFov: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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

export interface Asset {
  id: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  storagePath: string;
  createdAt: string;
}

export interface ProcessingJob {
  id: string;
  assetId: string;
  status: "pending" | "processing" | "done" | "failed";
  progress: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// Request DTOs
export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

// Response DTOs
export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

// Public tour (full payload for viewer)
export interface PublicTour {
  project: Project;
  scenes: (Scene & { hotspots: Hotspot[] })[];
}

// Viewer Engine types
export interface ViewerSceneData {
  id: string;
  name: string;
  imageUrl: string;
  initialYaw: number;
  initialPitch: number;
  initialFov: number;
}

export interface ViewerHotspot {
  id: string;
  label: string;
  description: string;
  position: [number, number, number];
  targetSceneId?: string;
  type: "info" | "navigation";
}

// WebSocket events
export type WSEvent =
  | { type: "processing_progress"; jobId: string; progress: number }
  | { type: "hotspot_created"; hotspot: Hotspot }
  | { type: "hotspot_updated"; hotspot: Hotspot }
  | { type: "hotspot_deleted"; hotspotId: string }
  | { type: "scene_changed"; sceneId: string };

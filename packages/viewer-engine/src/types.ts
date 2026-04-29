export interface ViewerOptions {
  fov?: number;
  rotateSpeed?: number;
  enableZoom?: boolean;
  minFov?: number;
  maxFov?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

export interface SceneData {
  id: string;
  name: string;
  imageUrl: string;
  /** URL base of the cubemap directory (e.g. "/storage/processed/{assetId}/cubemap"). If set, viewer prefers cubemap loading. */
  cubemapBaseUrl?: string;
  initialYaw?: number;
  initialPitch?: number;
  initialFov?: number;
}

export interface HotspotData {
  id: string;
  label: string;
  description?: string;
  position: [number, number, number];
  targetSceneId?: string;
  type: "info" | "navigation";
}

export interface CameraPose {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface CanvasClickEvent {
  point: { x: number; y: number; z: number };
  normalizedMouse: { x: number; y: number };
}

export interface ViewerEventMap {
  ready: void;
  sceneLoading: { sceneId: string };
  sceneLoaded: { sceneId: string };
  canvasClick: CanvasClickEvent;
  hotspotClick: { hotspot: HotspotData };
  hotspotHover: { hotspot: HotspotData | null };
  cameraChange: CameraPose;
  autoRotateChange: { enabled: boolean };
  vrStateChange: { active: boolean; supported: boolean };
  error: { message: string };
}

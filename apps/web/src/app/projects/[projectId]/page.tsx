"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, API_BASE, type Project, type Scene } from "@/lib/api";
import ViewerCanvas from "@/components/ViewerCanvas";
import HotspotModal from "@/components/HotspotModal";
import type { SceneData, HotspotData, CanvasClickEvent } from "@vr-tour/viewer-engine";

function sceneToViewerData(scene: Scene): SceneData {
  return {
    id: scene.id,
    name: scene.name,
    imageUrl: `${API_BASE}/storage/originals/${scene.assetFilename}`,
    cubemapBaseUrl: scene.cubemapDir
      ? `${API_BASE}/storage/${scene.cubemapDir}`
      : undefined,
    initialYaw: scene.initialYaw,
    initialPitch: scene.initialPitch,
    initialFov: scene.initialFov,
  };
}

function apiHotspotToViewer(h: { id: string; label: string; description: string; positionX: number; positionY: number; positionZ: number; targetSceneId?: string; type: string }): HotspotData {
  return {
    id: h.id,
    label: h.label,
    description: h.description,
    position: [h.positionX, h.positionY, h.positionZ],
    targetSceneId: h.targetSceneId,
    type: h.type as "info" | "navigation",
  };
}

export default function ProjectEditor() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [hotspots, setHotspots] = useState<HotspotData[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number; z: number } | null>(null);
  const [editingHotspot, setEditingHotspot] = useState<HotspotData | null>(null);

  // Load project + scenes on mount
  useEffect(() => {
    api.projects.get(projectId).then(setProject).catch((err) => setError(err.message));
    loadScenes();
  }, [projectId]);

  const loadScenes = useCallback(async () => {
    try {
      const res = await api.scenes.list(projectId);
      setScenes(res.scenes);
      if (res.scenes.length > 0 && !activeSceneId) {
        const first = res.scenes[0];
        setActiveSceneId(first.id);
        setSceneData(sceneToViewerData(first));
        loadHotspots(first.id);
      }
    } catch { /* silent on initial load */ }
  }, [projectId, activeSceneId]);

  const loadHotspots = useCallback(async (sceneId: string) => {
    try {
      const res = await api.hotspots.list(projectId, sceneId);
      setHotspots(res.hotspots.map(apiHotspotToViewer));
    } catch { setHotspots([]); }
  }, [projectId]);

  const switchScene = useCallback((scene: Scene) => {
    setActiveSceneId(scene.id);
    setSceneData(sceneToViewerData(scene));
    loadHotspots(scene.id);
    setEditMode(false);
  }, [loadHotspots]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const newScenes: Scene[] = [];
      for (const file of files) {
        const scene = await api.scenes.upload(projectId, file, file.name.replace(/\.[^.]+$/, ""));
        newScenes.push(scene);
      }
      
      setScenes((prev) => [...prev, ...newScenes]);
      
      // Auto-switch to the first uploaded scene
      if (newScenes.length > 0) {
        setActiveSceneId(newScenes[0].id);
        setSceneData(sceneToViewerData(newScenes[0]));
        setHotspots([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir escenas");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [projectId]);

  const handleCanvasClick = useCallback((event: CanvasClickEvent) => {
    if (!editMode || !activeSceneId) return;
    setPendingPoint(event.point);
    setEditingHotspot(null);
    setModalOpen(true);
  }, [editMode, activeSceneId]);

  const handleHotspotClick = useCallback((hotspot: HotspotData) => {
    if (editMode) {
      setEditingHotspot(hotspot);
      setPendingPoint(null);
      setModalOpen(true);
    } else if (hotspot.targetSceneId) {
      const target = scenes.find((s) => s.id === hotspot.targetSceneId);
      if (target) switchScene(target);
    }
  }, [editMode, scenes, switchScene]);

  const handleModalConfirm = useCallback(async (data: { label: string; description: string; targetSceneId: string; type: "info" | "navigation" }) => {
    if (!activeSceneId) return;
    setModalOpen(false);

    try {
      if (editingHotspot) {
        // Update existing
        const updated = await api.hotspots.update(projectId, activeSceneId, editingHotspot.id, {
          label: data.label,
          description: data.description,
          targetSceneId: data.targetSceneId || null,
          type: data.type,
        });
        setHotspots((prev) => prev.map((h) => h.id === editingHotspot.id ? apiHotspotToViewer(updated) : h));
      } else if (pendingPoint) {
        // Create new
        const created = await api.hotspots.create(projectId, activeSceneId, {
          label: data.label,
          description: data.description,
          positionX: pendingPoint.x,
          positionY: pendingPoint.y,
          positionZ: pendingPoint.z,
          targetSceneId: data.targetSceneId || undefined,
          type: data.type,
        });
        setHotspots((prev) => [...prev, apiHotspotToViewer(created)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving hotspot");
    }
    setPendingPoint(null);
    setEditingHotspot(null);
  }, [activeSceneId, projectId, editingHotspot, pendingPoint]);

  const handleModalDelete = useCallback(async () => {
    if (!editingHotspot || !activeSceneId) return;
    setModalOpen(false);
    try {
      await api.hotspots.delete(projectId, activeSceneId, editingHotspot.id);
      setHotspots((prev) => prev.filter((h) => h.id !== editingHotspot.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting hotspot");
    }
    setEditingHotspot(null);
  }, [editingHotspot, activeSceneId, projectId]);

  const handleDeleteScene = useCallback(async (sceneId: string, sceneName: string) => {
    if (!confirm(`¿Eliminar la escena "${sceneName}"? Se borrarán también sus hotspots.`)) return;
    try {
      await api.scenes.delete(projectId, sceneId);
      const remaining = scenes.filter((s) => s.id !== sceneId);
      setScenes(remaining);
      if (activeSceneId === sceneId) {
        if (remaining.length > 0) {
          switchScene(remaining[0]);
        } else {
          setActiveSceneId(null);
          setSceneData(null);
          setHotspots([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting scene");
    }
  }, [projectId, scenes, activeSceneId, switchScene]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Cargando proyecto...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Volver"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h1 className="font-semibold text-lg">{project.name}</h1>
            <p className="text-xs text-gray-500">{project.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
            disabled={uploading}
          >
            {uploading ? "Subiendo..." : "Subir Escenas"}
          </button>
          {sceneData && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                editMode
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 hover:bg-white/15"
              }`}
            >
              {editMode ? "Modo Edicion ON" : "Editar Hotspots"}
            </button>
          )}
          <button
            onClick={async () => {
              try {
                const updated = project.isPublished
                  ? await api.projects.unpublish(projectId)
                  : await api.projects.publish(projectId);
                setProject(updated);
              } catch {}
            }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              project.isPublished
                ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                : "bg-gray-500/15 text-gray-400 hover:bg-gray-500/25"
            }`}
          >
            {project.isPublished ? "Publicado" : "Borrador"}
          </button>
          {project.isPublished && (
            <a
              href={`/tours/${project.slug}`}
              target="_blank"
              className="px-3 py-1.5 text-xs rounded-lg bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors"
            >
              Ver Tour
            </a>
          )}
        </div>
      </div>

      {/* Viewer area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Scene sidebar */}
        {scenes.length > 0 && (
          <div className="w-52 bg-gray-900/60 border-r border-white/10 flex flex-col shrink-0">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/5">
              Escenas ({scenes.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {scenes.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center transition-colors ${
                    s.id === activeSceneId
                      ? "bg-blue-600/20 text-blue-300 border-l-2 border-blue-500"
                      : "text-gray-400 hover:bg-white/5 border-l-2 border-transparent"
                  }`}
                >
                  <button
                    onClick={() => switchScene(s)}
                    className="flex-1 px-3 py-2.5 text-left text-sm truncate"
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteScene(s.id, s.name); }}
                    className="p-1.5 mr-1 rounded text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Eliminar escena"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 relative">
          {sceneData ? (
            <>
              <ViewerCanvas
                sceneData={sceneData}
                hotspots={hotspots}
                editMode={editMode}
                onCanvasClick={handleCanvasClick}
                onHotspotClick={handleHotspotClick}
              />
              {editMode && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600/80 backdrop-blur-sm rounded-full text-sm font-medium">
                  Click en panoramica = nuevo hotspot · Click en hotspot = editar
                </div>
              )}
              {hotspots.length > 0 && (
                <div className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur-sm rounded-xl p-3 text-xs border border-white/10 max-h-60 overflow-y-auto">
                  <p className="font-semibold mb-2">{hotspots.length} hotspot(s)</p>
                  {hotspots.map((h) => (
                    <div key={h.id} className="flex items-center gap-1.5 py-0.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${h.type === "navigation" ? "bg-green-400" : "bg-blue-400"}`} />
                      <span className="text-gray-400 truncate max-w-[130px]">{h.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-950">
              <div className="text-center text-gray-500">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 text-gray-600">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                <p className="text-lg font-medium mb-2">Editor de Proyecto</p>
                <p className="text-sm mb-6">Sube una imagen panoramica 360 para comenzar</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition-colors text-white"
                >
                  Subir Escenas
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hotspot Modal */}
      <HotspotModal
        open={modalOpen}
        scenes={scenes.map((s) => ({ id: s.id, name: s.name }))}
        currentSceneId={activeSceneId ?? ""}
        isEditing={!!editingHotspot}
        initialData={
          editingHotspot
            ? {
                label: editingHotspot.label,
                description: editingHotspot.description,
                targetSceneId: editingHotspot.targetSceneId ?? "",
                type: editingHotspot.type,
              }
            : undefined
        }
        onConfirm={handleModalConfirm}
        onCancel={() => { setModalOpen(false); setPendingPoint(null); setEditingHotspot(null); }}
        onDelete={editingHotspot ? handleModalDelete : undefined}
      />
    </div>
  );
}

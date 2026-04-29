"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { publicApi, API_BASE, type PublicTourResponse, type Hotspot } from "@/lib/api";
import ViewerCanvas, { type ViewerCanvasHandle } from "@/components/ViewerCanvas";
import type { SceneData, HotspotData } from "@vr-tour/viewer-engine";

function hotspotToViewer(h: Hotspot): HotspotData {
  return {
    id: h.id,
    label: h.label,
    description: h.description,
    position: [h.positionX, h.positionY, h.positionZ],
    targetSceneId: h.targetSceneId,
    type: h.type,
  };
}

export default function PublicTourViewer() {
  const params = useParams();
  const slug = params.slug as string;

  const [tour, setTour] = useState<PublicTourResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredHotspot, setHoveredHotspot] = useState<HotspotData | null>(null);

  // WebXR state
  const [vrSupported, setVrSupported] = useState(false);
  const [vrActive, setVrActive] = useState(false);
  const [vrChecked, setVrChecked] = useState(false);

  const viewerRef = useRef<ViewerCanvasHandle>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    publicApi
      .getTour(slug)
      .then((data) => {
        setTour(data);
        if (data.scenes.length > 0) {
          setActiveSceneId(data.scenes[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Check VR support after engine is ready (slight delay for engine init)
  useEffect(() => {
    const timer = setTimeout(() => {
      viewerRef.current?.isVRSupported().then((supported) => {
        setVrSupported(supported);
        setVrChecked(true);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const activeScene = useMemo(
    () => tour?.scenes.find((s) => s.id === activeSceneId) ?? null,
    [tour, activeSceneId]
  );

  const sceneData: SceneData | null = useMemo(() => {
    if (!activeScene) return null;
    return {
      id: activeScene.id,
      name: activeScene.name,
      imageUrl: `${API_BASE}/storage/originals/${activeScene.assetFilename}`,
      cubemapBaseUrl: activeScene.cubemapDir
        ? `${API_BASE}/storage/${activeScene.cubemapDir}`
        : undefined,
      initialYaw: activeScene.initialYaw,
      initialPitch: activeScene.initialPitch,
      initialFov: activeScene.initialFov,
    };
  }, [activeScene]);

  const hotspots: HotspotData[] = useMemo(
    () => (activeScene?.hotspots ?? []).map(hotspotToViewer),
    [activeScene]
  );

  const handleHotspotClick = useCallback(
    (hotspot: HotspotData) => {
      if (hotspot.targetSceneId) {
        setActiveSceneId(hotspot.targetSceneId);
      }
    },
    []
  );

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current.requestFullscreen();
    }
  }, []);

  const handleVRToggle = useCallback(async () => {
    if (!viewerRef.current) return;
    if (vrActive) {
      await viewerRef.current.exitVR();
    } else {
      await viewerRef.current.enterVR();
    }
  }, [vrActive]);

  const handleVRStateChange = useCallback((active: boolean) => {
    setVrActive(active);
    // When entering VR, disable auto-rotate to avoid conflict with head tracking
    if (active) setAutoRotate(false);
  }, []);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">Tour no encontrado</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando tour...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="fixed inset-0 h-[100dvh] w-full flex flex-col overflow-hidden bg-black">
      <div className="flex-1 relative">
        {sceneData && (
          <ViewerCanvas
            ref={viewerRef}
            sceneData={sceneData}
            hotspots={hotspots}
            editMode={false}
            autoRotate={autoRotate}
            onHotspotClick={handleHotspotClick}
            onLoadingChange={setLoading}
            onHotspotHover={setHoveredHotspot}
            onVRStateChange={handleVRStateChange}
          />
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 transition-opacity">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-white/60 text-sm">Cargando escena...</p>
            </div>
          </div>
        )}

        {/* VR Active overlay — shown when immersive session is running */}
        {vrActive && (
          <div className="absolute inset-0 flex items-end justify-center pb-8 z-30 pointer-events-none">
            <div className="pointer-events-auto bg-black/70 backdrop-blur-md rounded-2xl px-6 py-3 flex items-center gap-3">
              {/* VR pulse indicator */}
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
              </span>
              <p className="text-white text-sm font-medium">Modo VR Activo</p>
              <button
                onClick={handleVRToggle}
                className="ml-2 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs transition-colors"
              >
                Salir VR
              </button>
            </div>
          </div>
        )}

        {/* Tour title */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-xl px-4 py-2 pointer-events-none z-10">
          <h1 className="text-white font-semibold">{tour.project.name}</h1>
          {activeScene && (
            <p className="text-gray-400 text-xs">{activeScene.name}</p>
          )}
        </div>

        {/* Hotspot tooltip */}
        {hoveredHotspot && (
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-none z-10 max-w-[200px]">
            <p className="text-white text-sm font-medium">{hoveredHotspot.label}</p>
            {hoveredHotspot.description && (
              <p className="text-gray-400 text-xs mt-0.5">{hoveredHotspot.description}</p>
            )}
            {hoveredHotspot.targetSceneId && (
              <p className="text-blue-400 text-xs mt-1">Click para navegar →</p>
            )}
          </div>
        )}

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {/* Scene pills (if multiple) */}
          {tour.scenes.length > 1 && (
            <div className="flex justify-center mb-2">
              <div className="flex gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
                {tour.scenes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSceneId(s.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      s.id === activeSceneId
                        ? "bg-white text-black"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center pb-4">
            <div className="flex gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1.5">
              {/* Auto-rotate */}
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`p-2 rounded-full transition-colors ${
                  autoRotate ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
                }`}
                title={autoRotate ? "Detener rotacion" : "Auto-rotar"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
                </svg>
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full text-white/50 hover:text-white/80 transition-colors"
                title={isFullscreen ? "Salir pantalla completa" : "Pantalla completa"}
              >
                {isFullscreen ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
                  </svg>
                )}
              </button>

              {/* ★ VR Button — only shown when device supports it */}
              {vrChecked && vrSupported && (
                <button
                  onClick={handleVRToggle}
                  className={`p-2 rounded-full transition-all ${
                    vrActive
                      ? "bg-purple-500/80 text-white ring-2 ring-purple-400"
                      : "text-white/50 hover:text-white/80 hover:bg-purple-500/30"
                  }`}
                  title={vrActive ? "Salir de VR" : "Entrar a VR (Meta Quest / WebXR)"}
                >
                  {/* VR Goggles icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8z"/>
                    <circle cx="8.5" cy="12" r="2.5"/>
                    <circle cx="15.5" cy="12" r="2.5"/>
                    <path d="M11 12h2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

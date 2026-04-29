"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import type { VRViewerEngine as EngineType, SceneData, HotspotData, CanvasClickEvent } from "@vr-tour/viewer-engine";

export interface ViewerCanvasHandle {
  toggleAutoRotate: () => boolean;
  setAutoRotate: (enabled: boolean) => void;
  getAutoRotate: () => boolean;
  enterVR: () => Promise<void>;
  exitVR: () => Promise<void>;
  isVRSupported: () => Promise<boolean>;
  vrActive: boolean;
}

interface Props {
  sceneData?: SceneData | null;
  hotspots?: HotspotData[];
  editMode?: boolean;
  autoRotate?: boolean;
  onCanvasClick?: (event: CanvasClickEvent) => void;
  onHotspotClick?: (hotspot: HotspotData) => void;
  onLoadingChange?: (loading: boolean) => void;
  onHotspotHover?: (hotspot: HotspotData | null) => void;
  onVRStateChange?: (active: boolean) => void;
}

const ViewerCanvas = forwardRef<ViewerCanvasHandle, Props>(function ViewerCanvas(
  {
    sceneData,
    hotspots = [],
    editMode = false,
    autoRotate,
    onCanvasClick,
    onHotspotClick,
    onLoadingChange,
    onHotspotHover,
    onVRStateChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EngineType | null>(null);
  const [ready, setReady] = useState(false);
  const [vrActive, setVrActive] = useState(false);

  useImperativeHandle(ref, () => ({
    toggleAutoRotate: () => engineRef.current?.toggleAutoRotate() ?? false,
    setAutoRotate: (enabled: boolean) => engineRef.current?.setAutoRotate(enabled),
    getAutoRotate: () => engineRef.current?.getAutoRotate() ?? false,
    enterVR: () => engineRef.current?.enterVR() ?? Promise.resolve(),
    exitVR: () => engineRef.current?.exitVR() ?? Promise.resolve(),
    isVRSupported: () => engineRef.current?.isVRSupported() ?? Promise.resolve(false),
    vrActive,
  }));

  // Initialize engine
  useEffect(() => {
    if (!containerRef.current) return;

    let engine: EngineType | null = null;

    import("@vr-tour/viewer-engine").then(({ VRViewerEngine }) => {
      if (!containerRef.current) return;
      engine = new VRViewerEngine(containerRef.current, {
        fov: 75,
        rotateSpeed: 0.4,
        autoRotate: autoRotate ?? false,
        autoRotateSpeed: 0.3,
      });
      engineRef.current = engine;
      setReady(true);
    });

    return () => {
      engine?.destroy();
      engineRef.current = null;
      setReady(false);
    };
  }, []);

  // Load scene (prefers cubemap if available, falls back to equirect)
  useEffect(() => {
    if (!engineRef.current || !sceneData) return;
    engineRef.current.loadScene(sceneData);
  }, [sceneData]);

  // Update hotspots
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setHotspots(hotspots);
  }, [hotspots]);

  // Edit mode
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setEditMode(editMode);
  }, [editMode]);

  // Auto rotate
  useEffect(() => {
    if (!engineRef.current || autoRotate === undefined) return;
    engineRef.current.setAutoRotate(autoRotate);
  }, [autoRotate]);

  // Event handlers
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const handleClick = (e: CanvasClickEvent) => onCanvasClick?.(e);
    const handleHotspot = (e: { hotspot: HotspotData }) => onHotspotClick?.(e.hotspot);
    const handleLoading = () => onLoadingChange?.(true);
    const handleLoaded = () => onLoadingChange?.(false);
    const handleHover = (e: { hotspot: HotspotData | null }) => onHotspotHover?.(e.hotspot);
    const handleVR = (e: { active: boolean; supported: boolean }) => {
      setVrActive(e.active);
      onVRStateChange?.(e.active);
    };

    engine.on("canvasClick", handleClick);
    engine.on("hotspotClick", handleHotspot);
    engine.on("sceneLoading", handleLoading);
    engine.on("sceneLoaded", handleLoaded);
    engine.on("hotspotHover", handleHover);
    engine.on("vrStateChange", handleVR);

    return () => {
      engine.off("canvasClick", handleClick);
      engine.off("hotspotClick", handleHotspot);
      engine.off("sceneLoading", handleLoading);
      engine.off("sceneLoaded", handleLoaded);
      engine.off("hotspotHover", handleHover);
      engine.off("vrStateChange", handleVR);
    };
  }, [onCanvasClick, onHotspotClick, onLoadingChange, onHotspotHover, onVRStateChange]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: "none" }}
    />
  );
});

export default ViewerCanvas;

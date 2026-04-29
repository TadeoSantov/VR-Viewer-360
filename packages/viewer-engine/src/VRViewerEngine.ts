import * as THREE from "three";
import { EventEmitter } from "./EventEmitter";
import { PanoControls } from "./PanoControls";
import { HotspotManager } from "./HotspotManager";
import type { ViewerOptions, SceneData, HotspotData, CameraPose } from "./types";

const SPHERE_RADIUS = 50;
const SPHERE_SEGMENTS = 64;

export class VRViewerEngine extends EventEmitter {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: PanoControls;
  private hotspots: HotspotManager;
  private textureLoader = new THREE.TextureLoader();
  private sphereMesh: THREE.Mesh | null = null;
  private mouse = new THREE.Vector2();
  private currentSceneId: string | null = null;
  private _editMode = false;
  private _destroyed = false;
  private lastHoveredHotspot: HotspotData | null = null;

  // WebXR state
  private _vrActive = false;
  private _xrSession: XRSession | null = null;

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    super();
    this.container = container;

    // Renderer — enable XR from the start
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // ★ Enable WebXR
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    // Camera
    const fov = options.fov ?? 75;
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 0);

    // Controls
    this.controls = new PanoControls(this.camera, this.renderer.domElement, {
      rotateSpeed: options.rotateSpeed ?? 0.4,
      enableZoom: options.enableZoom ?? true,
      minFov: options.minFov ?? 30,
      maxFov: options.maxFov ?? 110,
      autoRotate: options.autoRotate ?? false,
      autoRotateSpeed: options.autoRotateSpeed ?? 0.3,
    });

    // Hotspot manager
    this.hotspots = new HotspotManager(this.scene);

    // Events
    this.renderer.domElement.style.cursor = "grab";
    this.renderer.domElement.addEventListener("click", this.handleClick.bind(this));
    this.renderer.domElement.addEventListener("mousemove", this.handleMouseMove.bind(this));
    window.addEventListener("resize", this.handleResize.bind(this));

    // ★ Use setAnimationLoop instead of requestAnimationFrame — required for WebXR
    this.renderer.setAnimationLoop(this.animate.bind(this));

    this.emit("ready");
  }

  // --- Public API ---

  /**
   * Smart loader: prefers cubemap if cubemapBaseUrl is available, otherwise falls back to equirectangular.
   */
  loadScene(data: SceneData): void {
    if (data.cubemapBaseUrl) {
      this.loadCubemapScene(data);
    } else {
      this.loadEquirectangularScene(data);
    }
  }

  loadCubemapScene(data: SceneData): void {
    if (!data.cubemapBaseUrl) {
      this.loadEquirectangularScene(data);
      return;
    }

    this.emit("sceneLoading", { sceneId: data.id });
    this.clearSphere();

    const loader = new THREE.CubeTextureLoader();
    loader.setPath(data.cubemapBaseUrl + "/");

    loader.load(
      ["px.jpg", "nx.jpg", "py.jpg", "ny.jpg", "pz.jpg", "nz.jpg"],
      (cubeTexture) => {
        cubeTexture.colorSpace = THREE.SRGBColorSpace;
        this.scene.background = cubeTexture;
        this.setCameraFromData(data);
        this.currentSceneId = data.id;
        this.emit("sceneLoaded", { sceneId: data.id });
      },
      undefined,
      (err) => {
        console.warn("[VRViewerEngine] Cubemap load failed, falling back to equirect:", err);
        this.loadEquirectangularScene(data);
      }
    );
  }

  loadEquirectangularScene(data: SceneData): void {
    this.emit("sceneLoading", { sceneId: data.id });
    this.textureLoader.load(
      data.imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.EquirectangularReflectionMapping;

        if (this.scene.background instanceof THREE.CubeTexture) {
          (this.scene.background as THREE.CubeTexture).dispose();
          this.scene.background = new THREE.Color(0x0a0a0f);
        }

        this.clearSphere();

        const geo = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
        geo.scale(-1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ map: texture });
        this.sphereMesh = new THREE.Mesh(geo, mat);
        this.sphereMesh.name = "pano-sphere";
        this.scene.add(this.sphereMesh);

        this.setCameraFromData(data);
        this.currentSceneId = data.id;
        this.emit("sceneLoaded", { sceneId: data.id });
      },
      undefined,
      (err) => {
        console.error("[VRViewerEngine] Failed to load texture:", err);
        this.emit("error", { message: `Failed to load image: ${data.imageUrl}` });
      }
    );
  }

  // --- WebXR API ---

  /**
   * Check if the browser / device supports immersive-vr WebXR sessions.
   * Returns a Promise<boolean> — safe to call even when XR is unavailable.
   */
  async isVRSupported(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.xr) return false;
    try {
      return await navigator.xr.isSessionSupported("immersive-vr");
    } catch {
      return false;
    }
  }

  /**
   * Request an immersive-vr XR session and enter VR mode.
   * Must be called from a user gesture (button click).
   */
  async enterVR(): Promise<void> {
    if (!navigator.xr) {
      this.emit("error", { message: "WebXR no está disponible en este navegador." });
      return;
    }

    const supported = await this.isVRSupported();
    if (!supported) {
      this.emit("error", { message: "Este dispositivo no soporta VR inmersivo." });
      return;
    }

    try {
      const session = await navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
      });

      this._xrSession = session;
      await this.renderer.xr.setSession(session);
      this._vrActive = true;

      // Disable manual controls while in VR (head tracking handles orientation)
      this.controls.enabled = false;

      this.emit("vrStateChange", { active: true, supported: true });

      // Listen for session end (user exits VR via headset button)
      session.addEventListener("end", () => {
        this._vrActive = false;
        this._xrSession = null;
        this.controls.enabled = true;
        this.emit("vrStateChange", { active: false, supported: true });
      });
    } catch (err) {
      console.error("[VRViewerEngine] Failed to enter VR:", err);
      this.emit("error", { message: "No se pudo iniciar la sesión VR." });
    }
  }

  /**
   * Exit the active VR session programmatically.
   */
  async exitVR(): Promise<void> {
    if (this._xrSession) {
      await this._xrSession.end();
      // 'end' event listener above will clean up state
    }
  }

  get vrActive(): boolean {
    return this._vrActive;
  }

  // --- Standard API ---

  setHotspots(hotspots: HotspotData[]): void {
    this.hotspots.setAll(hotspots);
  }

  addHotspot(hotspot: HotspotData): void {
    this.hotspots.add(hotspot);
  }

  updateHotspot(hotspot: HotspotData): void {
    this.hotspots.update(hotspot);
  }

  removeHotspot(id: string): void {
    this.hotspots.remove(id);
  }

  setEditMode(enabled: boolean): void {
    this._editMode = enabled;
  }

  get editMode(): boolean {
    return this._editMode;
  }

  setAutoRotate(enabled: boolean): void {
    (this.controls as any).opts.autoRotate = enabled;
    this.emit("autoRotateChange", { enabled });
  }

  getAutoRotate(): boolean {
    return (this.controls as any).opts.autoRotate;
  }

  toggleAutoRotate(): boolean {
    const next = !this.getAutoRotate();
    this.setAutoRotate(next);
    return next;
  }

  getCameraPose(): CameraPose {
    const { yaw, pitch } = this.controls.getYawPitch();
    return { yaw, pitch, fov: this.camera.fov };
  }

  setCameraPose(pose: Partial<CameraPose>): void {
    if (pose.yaw !== undefined || pose.pitch !== undefined) {
      const current = this.controls.getYawPitch();
      this.controls.setYawPitch(pose.yaw ?? current.yaw, pose.pitch ?? current.pitch);
    }
    if (pose.fov !== undefined) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(): void {
    this.handleResize();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    // Stop XR session if active
    if (this._xrSession) {
      this._xrSession.end().catch(() => {});
    }

    // ★ Stop the XR animation loop
    this.renderer.setAnimationLoop(null);

    this.renderer.domElement.removeEventListener("click", this.handleClick.bind(this));
    this.renderer.domElement.removeEventListener("mousemove", this.handleMouseMove.bind(this));
    window.removeEventListener("resize", this.handleResize.bind(this));

    this.hotspots.dispose();
    this.controls.dispose();

    if (this.sphereMesh) {
      (this.sphereMesh.material as THREE.Material).dispose();
      (this.sphereMesh.geometry as THREE.BufferGeometry).dispose();
    }

    this.scene.clear();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }

    this.removeAllListeners();
  }

  // --- Private ---

  private animate(): void {
    if (this._destroyed) return;
    // In XR, controls should not apply (head tracking handles rotation)
    if (!this._vrActive) {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
  }

  private clearSphere(): void {
    if (this.sphereMesh) {
      (this.sphereMesh.material as THREE.Material).dispose();
      (this.sphereMesh.geometry as THREE.BufferGeometry).dispose();
      this.scene.remove(this.sphereMesh);
      this.sphereMesh = null;
    }
  }

  private setCameraFromData(data: SceneData): void {
    if (data.initialYaw !== undefined || data.initialPitch !== undefined) {
      this.controls.setYawPitch(data.initialYaw ?? 0, data.initialPitch ?? 0);
    }
    if (data.initialFov) {
      this.camera.fov = data.initialFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private handleClick(e: MouseEvent): void {
    this.updateMouse(e);

    const hit = this.hotspots.raycast(this.mouse, this.camera);
    if (hit) {
      this.emit("hotspotClick", { hotspot: hit.hotspot });
      return;
    }

    if (this._editMode && this.sphereMesh) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = raycaster.intersectObject(this.sphereMesh);
      if (intersects.length > 0) {
        const p = intersects[0].point;
        this.emit("canvasClick", {
          point: { x: p.x, y: p.y, z: p.z },
          normalizedMouse: { x: this.mouse.x, y: this.mouse.y },
        });
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    this.updateMouse(e);
    const hovered = this.hotspots.updateHover(this.mouse, this.camera);

    if (hovered !== this.lastHoveredHotspot) {
      this.lastHoveredHotspot = hovered;
      this.emit("hotspotHover", { hotspot: hovered });
      this.renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
    }
  }

  private updateMouse(e: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handleResize = (): void => {
    if (this._vrActive) return; // XR handles its own resize
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}

import * as THREE from "three";

export interface PanoControlsOptions {
  rotateSpeed: number;
  enableZoom: boolean;
  minFov: number;
  maxFov: number;
  damping: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
}

const DEFAULTS: PanoControlsOptions = {
  rotateSpeed: 0.4,
  enableZoom: true,
  minFov: 30,
  maxFov: 110,
  damping: 0.08,
  autoRotate: false,
  autoRotateSpeed: 0.3,
};

export class PanoControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private opts: PanoControlsOptions;

  private isPointerDown = false;
  private pointerStart = { x: 0, y: 0 };
  private spherical = new THREE.Spherical(1, Math.PI / 2, 0);
  private targetSpherical = new THREE.Spherical(1, Math.PI / 2, 0);

  enabled = true;

  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onWheel: (e: WheelEvent) => void;
  private onTouchStart: (e: TouchEvent) => void;
  private onTouchMove: (e: TouchEvent) => void;
  private onTouchEnd: () => void;

  private lastTouchDist = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: Partial<PanoControlsOptions> = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.opts = { ...DEFAULTS, ...options };

    // Bind event handlers
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onWheel = this.handleWheel.bind(this);
    this.onTouchStart = this.handleTouchStart.bind(this);
    this.onTouchMove = this.handleTouchMove.bind(this);
    this.onTouchEnd = this.handleTouchEnd.bind(this);

    domElement.addEventListener("pointerdown", this.onPointerDown);
    domElement.addEventListener("pointermove", this.onPointerMove);
    domElement.addEventListener("pointerup", this.onPointerUp);
    domElement.addEventListener("pointerleave", this.onPointerUp);
    domElement.addEventListener("wheel", this.onWheel, { passive: false });
    domElement.addEventListener("touchstart", this.onTouchStart, { passive: false });
    domElement.addEventListener("touchmove", this.onTouchMove, { passive: false });
    domElement.addEventListener("touchend", this.onTouchEnd);
  }

  private handlePointerDown(e: PointerEvent) {
    if (!this.enabled || e.pointerType === "touch") return;
    this.isPointerDown = true;
    this.pointerStart.x = e.clientX;
    this.pointerStart.y = e.clientY;
    this.domElement.style.cursor = "grabbing";
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.enabled || !this.isPointerDown || e.pointerType === "touch") return;

    const dx = e.clientX - this.pointerStart.x;
    const dy = e.clientY - this.pointerStart.y;
    this.pointerStart.x = e.clientX;
    this.pointerStart.y = e.clientY;

    const speed = this.opts.rotateSpeed * 0.01;
    this.targetSpherical.theta -= dx * speed;
    this.targetSpherical.phi = THREE.MathUtils.clamp(
      this.targetSpherical.phi - dy * speed,
      0.1,
      Math.PI - 0.1
    );
  }

  private handlePointerUp(_e: PointerEvent) {
    this.isPointerDown = false;
    this.domElement.style.cursor = "grab";
  }

  private handleWheel(e: WheelEvent) {
    if (!this.enabled || !this.opts.enableZoom) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 2 : -2;
    this.camera.fov = THREE.MathUtils.clamp(
      this.camera.fov + delta,
      this.opts.minFov,
      this.opts.maxFov
    );
    this.camera.updateProjectionMatrix();
  }

  private handleTouchStart(e: TouchEvent) {
    if (!this.enabled) return;
    if (e.touches.length === 1) {
      this.isPointerDown = true;
      this.pointerStart.x = e.touches[0].clientX;
      this.pointerStart.y = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this.lastTouchDist = this.getTouchDist(e);
    }
  }

  private handleTouchMove(e: TouchEvent) {
    if (!this.enabled) return;
    e.preventDefault();

    if (e.touches.length === 1 && this.isPointerDown) {
      const dx = e.touches[0].clientX - this.pointerStart.x;
      const dy = e.touches[0].clientY - this.pointerStart.y;
      this.pointerStart.x = e.touches[0].clientX;
      this.pointerStart.y = e.touches[0].clientY;

      const speed = this.opts.rotateSpeed * 0.01;
      this.targetSpherical.theta -= dx * speed;
      this.targetSpherical.phi = THREE.MathUtils.clamp(
        this.targetSpherical.phi - dy * speed,
        0.1,
        Math.PI - 0.1
      );
    } else if (e.touches.length === 2 && this.opts.enableZoom) {
      const dist = this.getTouchDist(e);
      const delta = (this.lastTouchDist - dist) * 0.1;
      this.camera.fov = THREE.MathUtils.clamp(
        this.camera.fov + delta,
        this.opts.minFov,
        this.opts.maxFov
      );
      this.camera.updateProjectionMatrix();
      this.lastTouchDist = dist;
    }
  }

  private handleTouchEnd() {
    this.isPointerDown = false;
  }

  private getTouchDist(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  setYawPitch(yaw: number, pitch: number) {
    this.targetSpherical.theta = THREE.MathUtils.degToRad(yaw);
    this.targetSpherical.phi = THREE.MathUtils.clamp(
      Math.PI / 2 - THREE.MathUtils.degToRad(pitch),
      0.1,
      Math.PI - 0.1
    );
    this.spherical.theta = this.targetSpherical.theta;
    this.spherical.phi = this.targetSpherical.phi;
  }

  getYawPitch(): { yaw: number; pitch: number } {
    return {
      yaw: THREE.MathUtils.radToDeg(this.spherical.theta),
      pitch: THREE.MathUtils.radToDeg(Math.PI / 2 - this.spherical.phi),
    };
  }

  update() {
    if (!this.enabled) return;

    if (this.opts.autoRotate && !this.isPointerDown) {
      this.targetSpherical.theta += this.opts.autoRotateSpeed * 0.001;
    }

    this.spherical.theta += (this.targetSpherical.theta - this.spherical.theta) * this.opts.damping;
    this.spherical.phi += (this.targetSpherical.phi - this.spherical.phi) * this.opts.damping;

    const target = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.lookAt(target);
  }

  dispose() {
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.domElement.removeEventListener("pointerleave", this.onPointerUp);
    this.domElement.removeEventListener("wheel", this.onWheel);
    this.domElement.removeEventListener("touchstart", this.onTouchStart);
    this.domElement.removeEventListener("touchmove", this.onTouchMove);
    this.domElement.removeEventListener("touchend", this.onTouchEnd);
  }
}

import * as THREE from "three";
import type { HotspotData } from "./types";

const HOTSPOT_RADIUS = 1.2;
const HOTSPOT_SEGMENTS = 24;

function createHotspotColors() {
  return {
    info: { base: 0x3b82f6, hover: 0x60a5fa },
    navigation: { base: 0x22c55e, hover: 0x4ade80 },
  };
}

export class HotspotManager {
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private meshMap = new Map<string, THREE.Mesh>();
  private dataMap = new Map<string, HotspotData>();
  private raycaster = new THREE.Raycaster();
  private hoveredId: string | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = "hotspots";
    this.scene.add(this.group);
  }

  add(hotspot: HotspotData): void {
    if (this.meshMap.has(hotspot.id)) this.remove(hotspot.id);

    const colors = createHotspotColors()[hotspot.type];

    // Outer ring
    const ringGeo = new THREE.RingGeometry(HOTSPOT_RADIUS * 0.7, HOTSPOT_RADIUS, HOTSPOT_SEGMENTS);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colors.base,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);

    // Inner circle
    const innerGeo = new THREE.CircleGeometry(HOTSPOT_RADIUS * 0.65, HOTSPOT_SEGMENTS);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.z = 0.01;

    // Center dot
    const dotGeo = new THREE.CircleGeometry(HOTSPOT_RADIUS * 0.2, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.z = 0.02;

    // Group them
    const hotspotGroup = new THREE.Mesh();
    hotspotGroup.add(ring, inner, dot);

    // Position on sphere (slightly inward so it floats inside)
    const pos = new THREE.Vector3(...hotspot.position).normalize().multiplyScalar(48);
    hotspotGroup.position.copy(pos);
    hotspotGroup.lookAt(0, 0, 0);

    hotspotGroup.userData = { hotspotId: hotspot.id };
    hotspotGroup.name = `hotspot-${hotspot.id}`;

    this.group.add(hotspotGroup);
    this.meshMap.set(hotspot.id, hotspotGroup);
    this.dataMap.set(hotspot.id, hotspot);
  }

  update(hotspot: HotspotData): void {
    this.remove(hotspot.id);
    this.add(hotspot);
  }

  remove(id: string): void {
    const mesh = this.meshMap.get(id);
    if (mesh) {
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
      this.group.remove(mesh);
      this.meshMap.delete(id);
      this.dataMap.delete(id);
    }
  }

  setAll(hotspots: HotspotData[]): void {
    this.clear();
    hotspots.forEach((h) => this.add(h));
  }

  clear(): void {
    const ids = [...this.meshMap.keys()];
    ids.forEach((id) => this.remove(id));
  }

  raycast(
    mouse: THREE.Vector2,
    camera: THREE.Camera
  ): { hotspot: HotspotData; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(mouse, camera);
    const meshes = [...this.meshMap.values()];
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      let obj: THREE.Object3D | null = intersects[0].object;
      while (obj && !obj.userData.hotspotId) {
        obj = obj.parent;
      }
      if (obj && obj.userData.hotspotId) {
        const data = this.dataMap.get(obj.userData.hotspotId);
        if (data) return { hotspot: data, point: intersects[0].point };
      }
    }
    return null;
  }

  updateHover(
    mouse: THREE.Vector2,
    camera: THREE.Camera
  ): HotspotData | null {
    const hit = this.raycast(mouse, camera);
    const newHoveredId = hit?.hotspot.id ?? null;

    if (newHoveredId !== this.hoveredId) {
      // Reset previous
      if (this.hoveredId) {
        const prev = this.meshMap.get(this.hoveredId);
        if (prev) prev.scale.setScalar(1);
      }
      // Highlight new
      if (newHoveredId) {
        const curr = this.meshMap.get(newHoveredId);
        if (curr) curr.scale.setScalar(1.2);
      }
      this.hoveredId = newHoveredId;
    }

    return hit?.hotspot ?? null;
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.group);
  }
}

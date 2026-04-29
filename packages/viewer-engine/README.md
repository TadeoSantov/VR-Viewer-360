# packages/viewer-engine

Motor 3D propio para tours 360/VR. TypeScript + Three.js directo (sin React Three Fiber).

Se implementará en Fase 3.

## API pública planeada

```ts
const engine = new VRViewerEngine(container, options);
engine.loadEquirectangularScene(sceneData);
engine.setHotspots(hotspots);
engine.addHotspot(hotspot);
engine.removeHotspot(id);
engine.setEditMode(true);
engine.on("hotspotClick", handler);
engine.on("canvasClick", handler);
engine.destroy();
```

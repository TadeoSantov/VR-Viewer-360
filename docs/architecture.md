# Arquitectura VR Tour Platform

## Diagrama de flujo

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Next.js Web   │────▶│   Go API Server  │────▶│     SQLite DB    │
│   (Dashboard,   │◀────│   (REST + WS)    │◀────│   (vr-tour.db)   │
│   Editor, Tour) │     │   :8080          │     └──────────────────┘
│   :3000         │     │                  │
└─────────────────┘     │   File Server    │────▶ storage/originals/
                        │   /storage/*     │────▶ storage/processed/
┌─────────────────┐     │                  │────▶ storage/thumbnails/
│  VRViewerEngine │     └────────┬─────────┘
│  (Three.js)     │              │
│  runs in browser│              ▼
└─────────────────┘     ┌──────────────────┐
                        │  Rust Worker     │  (Fase 8+)
                        │  image-processor │
                        └──────────────────┘
```

## Flujo: Usuario sube imagen

1. Usuario en Editor hace click "Subir escena"
2. File picker abre, selecciona imagen panorámica
3. Frontend envía POST /api/projects/:id/upload-scene (multipart)
4. Go recibe archivo, valida (tipo, tamaño)
5. Go genera nombre único, guarda en storage/originals/
6. Go crea registro en tabla assets
7. Go crea registro en tabla scenes (vinculada al asset)
8. Go responde con scene + asset URL
9. Frontend carga imageUrl en VRViewerEngine
10. Viewer muestra panorama 360

## Flujo: Usuario crea hotspot

1. Usuario activa modo edición
2. Click sobre panorama → VRViewerEngine emite "canvasClick" con posición 3D
3. React muestra modal de hotspot
4. Usuario llena nombre, descripción, escena destino
5. Frontend envía POST /api/scenes/:id/hotspots
6. Go guarda en SQLite
7. Frontend agrega hotspot al engine: engine.addHotspot(hotspot)
8. Hotspot aparece como mesh 3D en la escena

## Flujo: Navegación entre escenas

1. Usuario click en hotspot tipo "navigation"
2. VRViewerEngine emite "hotspotClick" con hotspot data
3. React verifica targetSceneId
4. Frontend pide datos de escena destino (ya cacheados o GET /api/scenes/:id)
5. engine.loadEquirectangularScene(newSceneData)
6. Engine hace crossfade entre texturas
7. Engine reemplaza hotspots con los de la nueva escena

## Capas del backend Go

```
handlers/    → Reciben HTTP, validan, responden JSON
    ↓
repository/  → Queries SQL, CRUD en SQLite
    ↓
database/    → Conexión SQLite, migraciones
    ↓
models/      → Structs de datos + DTOs
```

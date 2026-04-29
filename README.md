# VR Tour Platform

Plataforma profesional de tours virtuales 360/VR. Arquitectura propia inspirada en Marzipano pero 100% propia.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind CSS |
| Viewer Engine | Three.js directo (sin React Three Fiber) |
| Backend | Go 1.24 + Chi router |
| Base de datos | SQLite (dev) → PostgreSQL (prod) |
| Storage | Disco local (dev) → S3/R2 (prod) |
| Build | Turbopack → Webpack (Windows fix) |

## Estructura del Monorepo

```
vr-tour-platform/
├── apps/
│   ├── api/              → Backend Go (REST API)
│   └── web/              → Frontend Next.js (Dashboard + Visor)
├── packages/
│   └── viewer-engine/    → Motor 3D TypeScript independiente
├── storage/              → Archivos locales (uploads, DB)
└── README.md
```

## Features Completas

### Dashboard Administrativo (`/`)

- **Lista de proyectos** con cards visuales
- **Crear proyecto** con slug automático
- **Publicar/Despublicar** toggle instantáneo
- **Eliminar** con confirmación
- **Acceso al editor** → click en card

### Editor de Proyectos (`/projects/[id]`)

#### Gestión de Escenas
- **Upload de panorámicas** 360 (multipart/form-data)
- **Sidebar de escenas** con lista de todas las escenas del proyecto
- **Eliminar escena** (con confirmación + borrado de hotspots asociados)
- **Cambiar escena activa** → click en sidebar
- Todo se persiste en SQLite

#### Gestión de Hotspots
- **Crear hotspot** → "Editar Hotspots" → click en panorámica
- **Modal completo** para crear/editar:
  - Nombre (requerido)
  - Descripción (opcional)
  - **Selector de escena destino** (convierte en hotspot de navegación)
  - Auto-detección de tipo: info vs navigation
- **Editar hotspot** → click en hotspot existente (edit mode)
- **Eliminar hotspot** → botón en modal de edición
- **Navegación** → click en hotspot navigation (view mode) cambia escena
- **Hotspots persisten** en SQLite vía API

#### Controles del Editor
- Botón "Subir Escena" → file picker
- Botón "Editar Hotspots" → toggle modo edición
- Badge "Publicado/Borrador" → toggle publish/unpublish
- Link "Ver Tour" → abre `/tours/[slug]` en nueva pestaña (solo si publicado)
- **Indicador de hotspots** en esquina superior derecha (con badges de color por tipo)

### Visor Público (`/tours/[slug]`)

#### Experiencia Inmersiva
- **Pantalla completa** 360° con Three.js
- **Auto-rotate** activado por defecto (toggle en bottom bar)
- **Fullscreen** nativo del navegador (toggle en bottom bar)
- **Loading spinner** con blur overlay al cargar escenas
- **Hotspot tooltips** → hover muestra label + description + "Click para navegar"

#### Navegación
- **Pills de escenas** en bottom bar (si hay múltiples)
- **Click en hotspot navigation** → transición automática a escena destino
- **Título del tour** overlay en esquina superior izquierda

### API Backend (`http://localhost:8080`)

#### Endpoints REST

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/projects` | GET | Listar proyectos |
| `/api/projects` | POST | Crear proyecto |
| `/api/projects/{id}` | GET | Obtener proyecto |
| `/api/projects/{id}` | PATCH | Actualizar proyecto |
| `/api/projects/{id}` | DELETE | Eliminar proyecto |
| `/api/projects/{id}/publish` | POST | Publicar proyecto |
| `/api/projects/{id}/unpublish` | POST | Despublicar proyecto |
| `/api/projects/{id}/upload-scene` | POST | Subir imagen + crear scene |
| `/api/projects/{id}/scenes` | GET | Listar scenes |
| `/api/projects/{id}/scenes/{sceneId}` | GET | Obtener scene |
| `/api/projects/{id}/scenes/{sceneId}` | PATCH | Actualizar scene |
| `/api/projects/{id}/scenes/{sceneId}` | DELETE | Eliminar scene |
| `/api/projects/{id}/scenes/{sceneId}/hotspots` | GET | Listar hotspots de scene |
| `/api/projects/{id}/scenes/{sceneId}/hotspots` | POST | Crear hotspot |
| `/api/projects/{id}/scenes/{sceneId}/hotspots/{id}` | PATCH | Actualizar hotspot |
| `/api/projects/{id}/scenes/{sceneId}/hotspots/{id}` | DELETE | Eliminar hotspot |
| `/api/tours/{slug}` | GET | **Público**: tour completo (project + scenes + hotspots) |
| `/storage/*` | GET | Servir archivos estáticos (imágenes) |

### Viewer Engine (Three.js)

Clase `VRViewerEngine` con:

- **Renderizado** equirectangular 360° en esfera invertida
- **Controles personalizados** (PanoControls):
  - Mouse drag → rotar cámara (yaw/pitch)
  - Scroll → zoom (FOV)
  - Touch support
  - Auto-rotate con velocidad configurable
  - Damping suave
- **HotspotManager**:
  - Meshes 3D nativos (anillo + punto central)
  - Raycasting para hover/click
  - Animaciones de escala en hover
- **Eventos emitidos**:
  - `ready` → motor inicializado
  - `sceneLoading` → inicia carga de textura
  - `sceneLoaded` → textura cargada
  - `canvasClick` → click en esfera (para crear hotspot)
  - `hotspotClick` → click en hotspot
  - `hotspotHover` → hover/leave en hotspot
  - `autoRotateChange` → cambio de auto-rotate
  - `error` → error de carga

## Desarrollo Local

### Requisitos
- Go 1.24+
- Node.js 20+
- npm

### Backend (Go)

```bash
cd apps/api
go run .
# → http://localhost:8080
```

### Frontend (Next.js)

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

Nota: Usamos `--webpack` en lugar de Turbopack por un bug en Windows con symlinks de monorepo.

## Flujo de Uso Completo

1. **Crear proyecto** → Dashboard → "Nuevo Proyecto"
2. **Subir escenas** → Editor → "Subir Escena" (seleccionar JPG 360)
3. **Crear hotspots** → "Editar Hotspots" → click en panorámica → llenar modal → guardar
4. **Vincular escenas** → Al crear hotspot, seleccionar "Escena destino" en el dropdown
5. **Publicar** → Click en badge "Borrador" → cambia a "Publicado"
6. **Compartir** → Click en "Ver Tour" → copiar URL `/tours/mi-slug`

## Fases Completadas

- [x] **Fase 0**: Monorepo + estructura base
- [x] **Fase 1**: Backend Go + SQLite + API REST projects
- [x] **Fase 2**: Next.js + Dashboard con proyectos CRUD
- [x] **Fase 3**: Viewer Engine Three.js independiente
- [x] **Fase 4**: Upload scenes + hotspots CRUD + SQLite
- [x] **Fase 5**: Editor completo con modal de hotspot + scene sidebar
- [x] **Fase 6**: Visor público `/tours/[slug]` + endpoint público
- [x] **Fase 7**: UX mejorado (auto-rotate, fullscreen, loading, tooltips)

## Fases Pendientes

- [ ] **Fase 8**: Rust image processor (cubemap tiling, thumbnails)
- [ ] **Fase 9**: Tiled cubemap + LOD (múltiples resoluciones)
- [ ] **Fase 10**: WebXR / Meta Quest support
- [ ] **Fase 11**: User auth + multi-tenant
- [ ] **Fase 12**: Cloud deployment (Fly.io/Railway)

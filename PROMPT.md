# Prompt de Continuación - VR Tour Platform

## Contexto del Proyecto

**VR Tour Platform** es una plataforma profesional de tours virtuales 360°/VR, inspirada en Marzipano pero 100% propia. Permite crear tours inmersivos con múltiples escenas panorámicas y hotspots de navegación.

### Stack Tecnológico
- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **Viewer Engine**: Three.js directo (sin React Three Fiber) - motor 3D propio en `packages/viewer-engine`
- **Backend**: Go 1.24 + Chi router + SQLite
- **Storage**: Disco local (dev) con plan de migrar a S3/R2

### Estructura del Monorepo
```
vr-tour-platform/
├── apps/
│   ├── api/              → Backend Go (REST API)
│   │   ├── internal/
│   │   │   ├── handlers/    → HTTP handlers (projects, scenes, hotspots, public)
│   │   │   ├── models/      → Structs y DTOs
│   │   │   ├── repository/  → Acceso a SQLite
│   │   │   └── config/      → Configuración
│   │   └── main.go
│   └── web/              → Frontend Next.js
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx              → Dashboard
│       │   │   ├── projects/[id]/page.tsx → Editor
│       │   │   └── tours/[slug]/page.tsx  → Visor público
│       │   ├── components/
│       │   │   ├── ViewerCanvas.tsx      → Wrapper React del engine 3D
│       │   │   ├── HotspotModal.tsx      → Modal crear/editar hotspot
│       │   │   └── Dashboard.tsx
│       │   └── lib/api.ts                → Cliente API con tipos
│       └── package.json  → Usa "file:../../packages/viewer-engine"
├── packages/
│   └── viewer-engine/    → Motor 3D TypeScript independiente
│       ├── src/
│       │   ├── VRViewerEngine.ts   → Clase principal
│       │   ├── PanoControls.ts     → Controles cámara
│       │   ├── HotspotManager.ts   → Gestión hotspots 3D
│       │   ├── EventEmitter.ts     → Sistema de eventos tipado
│       │   └── types.ts            → Interfaces TypeScript
│       └── package.json
└── storage/              → SQLite + uploads
```

---

## ✅ Estado Actual (Fases 0-7 Completadas)

### Fase 0-3: Infra + Backend + Dashboard + Engine 3D
- Backend Go con Chi router
- SQLite con migrations automáticas
- CRUD completo de proyectos
- Dashboard Next.js con lista de proyectos
- Viewer Engine Three.js funcional (esfera equirectangular, controles cámara, hotspots 3D)

### Fase 4: Upload + Scenes + Hotspots
- Endpoint multipart `/upload-scene` → guarda archivo + crea scene + asset
- Scene repository con CRUD y ordenamiento
- Hotspot repository con CRUD
- Sidebar de escenas en el editor
- Hotspots persisten en SQLite

### Fase 5: Editor Completo
- Modal de hotspot con:
  - Nombre, descripción
  - **Selector de escena destino** (dropdown con otras escenas)
  - Auto-detección tipo: info vs navigation
- Editar hotspot → click en hotspot (edit mode)
- Eliminar escena con confirmación (borra hotspots asociados)
- Indicador de hotspots en esquina

### Fase 6: Visor Público
- Endpoint `/api/tours/{slug}` → devuelve project + scenes + hotspots anidados
- Página `/tours/[slug]` con visor inmersivo
- Publicar/Despublicar toggle en editor
- Link "Ver Tour" cuando está publicado

### Fase 7: UX Mejorado
- Auto-rotate activado por defecto
- Fullscreen nativo toggle
- Loading spinner al cambiar escenas
- Hotspot tooltips en hover
- Bottom bar con controles
- **Fix importante**: Cambio de Turbopack a Webpack (bug Windows con symlinks)

---

## 🎯 Tu Misión: Fase 8 - Rust Image Processor

### Objetivo
Crear un crate de Rust (`crates/image-processor/`) que procese imágenes 360° eficientemente para:

1. **Generar thumbnails** de escenas (preview rápido)
2. **Convertir equirectangular → cubemap** (6 caras: front, back, left, right, top, bottom)
3. **Crear tiled cubemap** (múltiples niveles de resolución para LOD)

### Por qué Rust
- Rendimiento nativo para operaciones de píxeles
- Ecosistema maduro: `image`, `imageproc`, `rayon` (paralelismo)
- Puede compilarse como CLI o integrarse como worker del backend Go

### Estructura Esperada
```
crates/image-processor/
├── Cargo.toml
├── src/
│   ├── lib.rs              → API pública (funciones exportables)
│   ├── equirect.rs         → Proyecciones equirectangular
│   ├── cubemap.rs          → Generación de 6 caras
│   ├── tiling.rs           → Tiling multi-resolución
│   └── main.rs             → CLI tool para testing
└── tests/
    └── fixtures/           → Imágenes de prueba 360
```

### Funcionalidades Específicas

#### 1. Thumbnail Generator
```rust
pub fn generate_thumbnail(input_path: &str, output_path: &str, size: u32) -> Result<(), Error>
```
- Entrada: imagen 360° grande (ej: 8192x4096)
- Salida: thumbnail proporcional (ej: 512x256)
- Debe preservar proporción 2:1

#### 2. Equirectangular to Cubemap
```rust
pub fn equirect_to_cubemap(input_path: &str, output_dir: &str, face_size: u32) -> Result<(), Error>
```
- Proyección matemática equirectangular → dirección 3D
- Generar 6 imágenes: `px.jpg`, `nx.jpg`, `py.jpg`, `ny.jpg`, `pz.jpg`, `nz.jpg`
- Cada cara es cuadrada (face_size x face_size)
- Usar interpolación bilinear para calidad

#### 3. Tiled Cubemap (LOD)
```rust
pub fn generate_tiled_cubemap(
    input_path: &str,
    output_dir: &str,
    max_face_size: u32,
    levels: u32,
) -> Result<(), Error>
```
- Generar pirámide de resoluciones: max_face_size, max_face_size/2, max_face_size/4...
- Estructura de carpetas:
  ```
  output/
  ├── 0/          → nivel más alto resolución
  │   ├── px/
  │   │   ├── 0_0.jpg
  │   │   ├── 0_1.jpg
  │   │   └── ...
  │   ├── nx/
  │   └── ...
  ├── 1/          → mitad de resolución
  └── 2/          → cuarto de resolución
  ```
- Cada nivel divide la cara en tiles (ej: 512x512 píxeles por tile)

### Integración con Backend Go

El backend debe poder llamar al procesador Rust de dos formas:

1. **CLI** (simple, para empezar):
   ```go
   cmd := exec.Command("./image-processor", "--input", filePath, "--output", outDir, "--mode", "cubemap")
   ```

2. **Biblioteca** (optimizado, más adelante):
   Usar `cgo` o `ffi` para llamar funciones Rust directamente desde Go

### Flujo de Trabajo Esperado

1. Usuario sube imagen 360° → guarda en `storage/originals/`
2. Backend llama a Rust processor:
   - Genera thumbnail → `storage/thumbnails/{scene_id}.jpg`
   - Genera cubemap → `storage/cubemaps/{scene_id}/`
   - Genera tiles → `storage/tiles/{scene_id}/`
3. Backend actualiza DB con paths de assets procesados
4. Frontend viewer usa tiles para LOD progresivo

### Recursos Útiles

- **Fórmula proyección equirectangular**: 
  - θ (azimuth) = (u + 0.5) * 2π
  - φ (elevation) = (v + 0.5) * π
  - x = cos(φ) * sin(θ)
  - y = sin(φ)
  - z = cos(φ) * cos(θ)
  
- **Crate `image`**: https://docs.rs/image/latest/image/
- **Crate `rayon`**: Paralelismo con `par_iter()`

### Criterios de Éxito

- [ ] `cargo build` compila sin errores
- [ ] `cargo test` pasa tests básicos
- [ ] Procesa una imagen 4K en < 2 segundos
- [ ] Output visualmente correcto (sin distorsiones)
- [ ] Integración básica con backend Go (ejecución CLI)

---

## 🔑 Código Clave para Entender

### 1. Scene Upload Handler (Go)
Ubicación: `apps/api/internal/handlers/scenes.go`

El método `UploadScene` maneja multipart uploads:
- Guarda archivo en `storage/originals/`
- Crea registro en tabla `assets`
- Crea registro en tabla `scenes` vinculado al asset

**Aquí es donde debes agregar la llamada al procesador Rust después de guardar el archivo.**

### 2. Viewer Engine - Scene Loading
Ubicación: `packages/viewer-engine/src/VRViewerEngine.ts`

El método `loadEquirectangularScene` carga la textura desde URL. Actualmente usa la imagen original completa. En Fase 9, deberá usar los tiles generados por Rust para LOD progresivo.

### 3. Estructura de Storage Actual
```
storage/
├── vr-tour.db              → SQLite
├── originals/              → Imágenes subidas (sin procesar)
└── (aquí irán thumbnails/, cubemaps/, tiles/)
```

---

## 🚀 Plan Sugerido de Implementación

### Paso 1: Setup del Crate (30 min)
```bash
cd crates/
cargo new image-processor
cd image-processor
cargo add image imageproc rayon anyhow
touch src/equirect.rs src/cubemap.rs src/tiling.rs
```

### Paso 2: Thumbnail (1 hora)
- Implementar resize simple
- CLI básico con `clap`
- Test con imagen real

### Paso 3: Equirect to Cubemap (2-3 horas)
- Implementar proyección matemática
- Generar 6 caras
- Asegurar calidad de interpolación

### Paso 4: Tiling (2 horas)
- Generar pirámide de resoluciones
- Dividir en tiles
- Estructura de carpetas

### Paso 5: Integración Go (1 hora)
- Compilar Rust como binario
- Llamar desde `sceneHandler.UploadScene`
- Guardar paths en base de datos

### Paso 6: Tests y Documentación (1 hora)
- Unit tests
- Documentación inline
- README del crate

---

## 📋 Checklist de Entrega

- [ ] `crates/image-processor/` creado y funcional
- [ ] `cargo build` exitoso
- [ ] CLI puede generar thumbnail, cubemap y tiles
- [ ] Backend Go integra el procesador en upload
- [ ] Documentación de uso en `crates/image-processor/README.md`
- [ ] Tests básicos pasando

---

## 📞 Contacto / Issues

Si encuentras problemas:
1. Revisar logs de `apps/api` para errores de integración
2. Verificar que la imagen de prueba sea equirectangular 2:1
3. Asegurar que el binario de Rust tenga permisos de ejecución

---

## 🎁 Bonus (si hay tiempo)

- **WebP output**: Mejor compresión que JPEG
- **Progresivo**: Generar versión borrosa primero, luego detalle
- **Metadata**: Preservar EXIF de la imagen original
- **Progress tracking**: API para reportar progreso del procesamiento

---

**¡Adelante! El código base está sólido, el procesamiento de imágenes es la pieza clave para escalar a tours grandes con muchas escenas de alta resolución.**

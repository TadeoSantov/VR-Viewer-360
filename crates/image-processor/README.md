# Image Processor - VR Tour Platform

Procesador de imágenes Rust para convertir panoramas 360° en cubemaps tileados con niveles de LOD (Level of Detail) progresivos.

## Características

- **Thumbnail Generator**: Reduce imágenes 360° a thumbnails eficientes (2:1 ratio)
- **Equirectangular → Cubemap**: Convierte proyección equirectangular a 6 caras de cubemap
- **Tiled Cubemap**: Genera tiles de resolución múltiple para streaming progresivo
- **CLI Tool**: Herramienta de línea de comandos para testing y debugging
- **Biblioteca**: API tipada para integración con backend Go

## Building

```bash
cargo build --release
```

El ejecutable estará en `target/release/image-processor`

## CLI Usage

### Generar Thumbnail
```bash
./image-processor thumbnail --input panorama.jpg --output thumb.jpg --width 512
```

### Convertir a Cubemap
```bash
./image-processor cubemap --input panorama.jpg --output ./cubemap --face-size 1024
```

Genera:
- `cubemap/px.jpg` - Positive X (right)
- `cubemap/nx.jpg` - Negative X (left)
- `cubemap/py.jpg` - Positive Y (top)
- `cubemap/ny.jpg` - Negative Y (bottom)
- `cubemap/pz.jpg` - Positive Z (front)
- `cubemap/nz.jpg` - Negative Z (back)

### Generar Tiled Cubemap
```bash
./image-processor tiled-cubemap \
  --input ./cubemap \
  --output ./tiles \
  --max-face-size 2048 \
  --tile-size 256 \
  --max-levels 4
```

Estructura de salida:
```
tiles/
├── px/
│   ├── level_0/
│   │   ├── 0.jpg    (8x8 = 64 tiles de 256x256)
│   │   ├── 1.jpg
│   │   └── ...
│   └── level_1/
│       ├── 0.jpg    (4x4 = 16 tiles)
│       └── ...
├── nx/, py/, ny/, pz/, nz/
└── metadata.json    (configuración y mapping)
```

### Pipeline Completo
```bash
./image-processor process \
  --input panorama.jpg \
  --output ./processed \
  --cubemap-size 1024 \
  --tile-size 256 \
  --max-levels 4
```

Genera automáticamente:
- `processed/thumbnail.jpg`
- `processed/cubemap/` (6 caras)
- `processed/tiles/` (tiles con LOD)

## Library Usage

```rust
use image_processor::*;

// Thumbnail
generate_thumbnail("panorama.jpg", "thumb.jpg", 512)?;

// Cubemap
equirect_to_cubemap("panorama.jpg", "./cubemap", 1024)?;

// Tiled cubemap
generate_tiled_cubemap("./cubemap", "./tiles", 2048, 256, 4)?;

// Todo de una vez
process_full_pipeline("panorama.jpg", "./output", 1024, 256, 4)?;
```

## Integración con Backend Go

### Opción 1: CLI (actual)
```go
cmd := exec.Command("image-processor", "process",
    "--input", filePath,
    "--output", outputDir,
    "--cubemap-size", "1024",
    "--tile-size", "256",
    "--max-levels", "4",
)
err := cmd.Run()
```

### Opción 2: Biblioteca Rust (futuro)
Compilar como rlib + usar cgo o wasm-bindgen para FFI.

## Requisitos de Entrada

- Imagen equirectangular en formato JPEG o PNG
- Proporción 2:1 (ancho = alto × 2)
- Recomendado: 4096x2048 o 8192x4096 para buena calidad
- Formato RGB o RGBA (se convierte a RGB automáticamente)

## Algoritmo de Proyección

### Equirectangular → Vector 3D
```
θ = (u + 0.5) * 2π
φ = (v + 0.5) * π
x = cos(φ) * sin(θ)
y = sin(φ)
z = cos(φ) * cos(θ)
```

### Sampling
- Interpolación **bilineal** para suavidad
- Filtro **Lanczos3** para redimensionamiento

## Rendimiento

- Procesamiento **paralelizable** (rayon ready)
- Típicamente < 5s para imagen 8K → cubemap + tiles
- Uso de memoria: ~2-3x tamaño de imagen original

## Testing

```bash
cargo test
cargo test -- --nocapture
```

## Estructura Interna

```
src/
├── lib.rs           API pública
├── main.rs          CLI
├── errors.rs        Tipos de error
├── types.rs         Tipos comunes (Vector3, CubemapFace, etc.)
├── equirect.rs      Proyección equirectangular
├── cubemap.rs       Utilidades de cubemap
└── tiling.rs        Generación de tiles y LOD
```

## Próximos Pasos

1. **Paralelización**: Usar `rayon` para procesar múltiples tiles en paralelo
2. **Formato comprimido**: Soporte para WebP, AVIF
3. **FFI**: Exponerlo como librería C para llamadas desde Go
4. **Optimización**: SIMD para operaciones de píxeles
5. **Configuración**: JSON config para presets de calidad

## Licencia

MIT

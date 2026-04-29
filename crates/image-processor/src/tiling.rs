use crate::errors::Result;
use image::RgbImage;
use std::path::Path;

/// Información de un nivel de LOD
#[derive(Debug, Clone)]
pub struct LodLevel {
    pub level: u32,
    pub face_size: u32,
    pub tile_size: u32,
}

impl LodLevel {
    pub fn tiles_per_side(&self) -> u32 {
        self.face_size / self.tile_size
    }

    pub fn total_tiles(&self) -> u32 {
        let tps = self.tiles_per_side();
        tps * tps
    }
}

/// Genera tiles para un nivel de LOD
pub fn generate_tiled_level(
    input_image: &RgbImage,
    face_size: u32,
    tile_size: u32,
) -> Result<Vec<RgbImage>> {
    let tiles_per_side = face_size / tile_size;
    let mut tiles = Vec::new();
    let mut img_copy = input_image.clone();

    for ty in 0..tiles_per_side {
        for tx in 0..tiles_per_side {
            let x = tx * tile_size;
            let y = ty * tile_size;

            // Extraer región
            let tile = image::imageops::crop(
                &mut img_copy,
                x,
                y,
                tile_size,
                tile_size,
            )
            .to_image();

            tiles.push(tile);
        }
    }

    Ok(tiles)
}

/// Descala imagen a mitad de resolución (para siguiente nivel LOD)
fn create_next_lod_level(image: &RgbImage) -> RgbImage {
    let (w, h) = image.dimensions();
    let new_w = w / 2;
    let new_h = h / 2;

    image::imageops::resize(
        image,
        new_w,
        new_h,
        image::imageops::FilterType::Lanczos3,
    )
}

/// Genera pirámide de tiles para una cara del cubemap
pub fn generate_face_pyramid(
    face_image: &RgbImage,
    _max_face_size: u32,
    tile_size: u32,
    max_levels: u32,
    output_face_dir: &str,
) -> Result<Vec<LodLevel>> {
    let mut current_image = face_image.clone();
    let mut levels = Vec::new();

    std::fs::create_dir_all(output_face_dir)?;

    for level in 0..max_levels {
        let (w, h) = current_image.dimensions();
        if w < tile_size || h < tile_size {
            break; // Demasiado pequeño para este nivel
        }

        let lod = LodLevel {
            level,
            face_size: w,
            tile_size,
        };

        // Crear directorio del nivel
        let level_dir = format!("{}/level_{}", output_face_dir, level);
        std::fs::create_dir_all(&level_dir)?;

        // Generar tiles para este nivel
        let tiles = generate_tiled_level(&current_image, w, tile_size)?;

        // Guardar tiles
        for (idx, tile) in tiles.iter().enumerate() {
            let tile_path = format!("{}/{}.jpg", level_dir, idx);
            tile.save(&tile_path)?;
        }

        levels.push(lod);

        // Preparar para siguiente nivel
        current_image = create_next_lod_level(&current_image);
    }

    Ok(levels)
}

/// Genera tiled cubemap con múltiples niveles de LOD
/// Estructura de salida:
/// output_dir/
///   ├── 0/          (nivel 0: max_face_size)
///   │   ├── px/
///   │   │   ├── level_0/
///   │   │   │   ├── 0.jpg
///   │   │   │   ├── 1.jpg
///   │   │   │   └── ...
///   │   │   └── level_1/
///   │   ├── nx/
///   │   └── ...
///   └── metadata.json
pub fn generate_tiled_cubemap(
    cubemap_dir: &str,
    output_dir: &str,
    max_face_size: u32,
    tile_size: u32,
    max_levels: u32,
) -> Result<()> {
    let faces = vec!["px", "nx", "py", "ny", "pz", "nz"];

    std::fs::create_dir_all(output_dir)?;

    let mut metadata = serde_json::json!({
        "max_face_size": max_face_size,
        "tile_size": tile_size,
        "max_levels": max_levels,
        "faces": {}
    });

    for face_name in faces {
        let input_path = format!("{}/{}.jpg", cubemap_dir, face_name);
        if !Path::new(&input_path).exists() {
            continue; // Saltar caras faltantes
        }

        let face_image = image::open(&input_path)?
            .to_rgb8();

        let output_face_dir = format!("{}/{}", output_dir, face_name);
        let levels = generate_face_pyramid(
            &face_image,
            max_face_size,
            tile_size,
            max_levels,
            &output_face_dir,
        )?;

        // Registrar metadatos de esta cara
        let levels_data: Vec<_> = levels.iter().map(|l| {
            serde_json::json!({
                "level": l.level,
                "face_size": l.face_size,
                "tile_size": l.tile_size,
                "tiles_per_side": l.tiles_per_side(),
                "total_tiles": l.total_tiles(),
            })
        }).collect();

        metadata["faces"][face_name] = serde_json::json!({
            "levels": levels_data
        });
    }

    // Guardar metadatos
    let metadata_path = format!("{}/metadata.json", output_dir);
    std::fs::write(&metadata_path, metadata.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lod_level_calculations() {
        let lod = LodLevel {
            level: 0,
            face_size: 512,
            tile_size: 64,
        };

        assert_eq!(lod.tiles_per_side(), 8);
        assert_eq!(lod.total_tiles(), 64);
    }

    #[test]
    fn test_generate_tiled_level() {
        let img = RgbImage::new(256, 256);
        let tiles = generate_tiled_level(&img, 256, 64).unwrap();
        assert_eq!(tiles.len(), 16); // 4x4 tiles
    }
}

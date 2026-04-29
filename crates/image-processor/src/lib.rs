pub mod errors;
pub mod types;
pub mod equirect;
pub mod cubemap;
pub mod tiling;

pub use errors::{ImageProcessorError, Result};
pub use types::{Size, Vector3, CubemapFace};

use std::path::Path;

/// Genera un thumbnail de una imagen 360°
/// 
/// # Argumentos
/// * `input_path` - Ruta a la imagen equirectangular original
/// * `output_path` - Ruta donde guardar el thumbnail
/// * `width` - Ancho del thumbnail (alto será proporcional 2:1)
/// 
/// # Ejemplo
/// ```ignore
/// generate_thumbnail("image.jpg", "thumb.jpg", 512)?;
/// // Genera thumbnail de 512x256
/// ```
pub fn generate_thumbnail(input_path: &str, output_path: &str, width: u32) -> Result<()> {
    // Cargar imagen original
    let img = image::open(input_path)?
        .to_rgb8();

    let (orig_w, orig_h) = img.dimensions();
    
    // Validar proporción 2:1
    if orig_w != orig_h * 2 {
        return Err(ImageProcessorError::InvalidDimensions(
            format!("Expected 2:1 ratio, got {}x{}", orig_w, orig_h),
        ));
    }

    // Calcular alto manteniendo proporción 2:1
    let height = width / 2;

    // Descalar imagen
    let thumbnail = image::imageops::resize(
        &img,
        width,
        height,
        image::imageops::FilterType::Lanczos3,
    );

    // Guardar con buena calidad
    thumbnail.save(output_path)?;
    
    Ok(())
}

/// Convierte una imagen equirectangular a cubemap
/// 
/// # Argumentos
/// * `input_path` - Ruta a la imagen equirectangular
/// * `output_dir` - Directorio donde guardar las 6 caras (px.jpg, nx.jpg, etc.)
/// * `face_size` - Tamaño de cada cara cuadrada en píxeles (ej: 1024)
/// 
/// # Ejemplo
/// ```ignore
/// equirect_to_cubemap("panorama.jpg", "./cubemap", 1024)?;
/// // Crea px.jpg, nx.jpg, py.jpg, ny.jpg, pz.jpg, nz.jpg de 1024x1024
/// ```
pub fn equirect_to_cubemap(input_path: &str, output_dir: &str, face_size: u32) -> Result<()> {
    equirect::equirect_to_cubemap(input_path, output_dir, face_size)
}

/// Valida un cubemap generado
/// 
/// Verifica que todas las 6 caras existan y tengan el tamaño correcto
pub fn validate_cubemap(output_dir: &str, face_size: u32) -> Result<cubemap::CubemapInfo> {
    cubemap::validate_cubemap(output_dir, face_size)
}

/// Genera tiled cubemap con múltiples niveles de LOD
/// 
/// # Argumentos
/// * `cubemap_dir` - Directorio con cubemap ya generado (px.jpg, nx.jpg, etc.)
/// * `output_dir` - Directorio base para guardar los tiles
/// * `max_face_size` - Tamaño máximo de cara para nivel 0
/// * `tile_size` - Tamaño de cada tile individual (ej: 256 píxeles)
/// * `max_levels` - Máximo número de niveles LOD a generar
/// 
/// # Estructura de salida
/// ```text
/// output_dir/
/// ├── px/
/// │   ├── level_0/
/// │   │   ├── 0.jpg
/// │   │   ├── 1.jpg
/// │   │   └── ...
/// │   └── level_1/
/// ├── nx/, py/, ny/, pz/, nz/
/// └── metadata.json
/// ```
pub fn generate_tiled_cubemap(
    cubemap_dir: &str,
    output_dir: &str,
    max_face_size: u32,
    tile_size: u32,
    max_levels: u32,
) -> Result<()> {
    // Validar directorios
    if !Path::new(cubemap_dir).is_dir() {
        return Err(ImageProcessorError::InvalidConfig(
            format!("Cubemap directory not found: {}", cubemap_dir),
        ));
    }

    tiling::generate_tiled_cubemap(
        cubemap_dir,
        output_dir,
        max_face_size,
        tile_size,
        max_levels,
    )
}

/// Procesa completamente una imagen 360° desde equirectangular hasta tiled cubemap
/// 
/// # Argumentos
/// * `input_path` - Imagen equirectangular original
/// * `output_base_dir` - Directorio base para todos los outputs
/// * `cubemap_face_size` - Tamaño de caras del cubemap
/// * `tile_size` - Tamaño de tiles individuales
/// * `max_lod_levels` - Niveles de LOD a generar
pub fn process_full_pipeline(
    input_path: &str,
    output_base_dir: &str,
    cubemap_face_size: u32,
    tile_size: u32,
    max_lod_levels: u32,
) -> Result<()> {
    std::fs::create_dir_all(output_base_dir)?;

    // Generar thumbnail
    let thumbnail_path = format!("{}/thumbnail.jpg", output_base_dir);
    generate_thumbnail(input_path, &thumbnail_path, 512)?;

    // Generar cubemap
    let cubemap_dir = format!("{}/cubemap", output_base_dir);
    equirect_to_cubemap(input_path, &cubemap_dir, cubemap_face_size)?;

    // Generar tiled cubemap
    let tiles_dir = format!("{}/tiles", output_base_dir);
    generate_tiled_cubemap(&cubemap_dir, &tiles_dir, cubemap_face_size, tile_size, max_lod_levels)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_equirect_dimensions() {
        // Crear una imagen con proporción incorrecta
        let img = image::RgbImage::new(100, 100);
        let tmp = std::env::temp_dir();
        let test_path = tmp.join("test_equirect.jpg");
        let thumb_path = tmp.join("test_thumb.jpg");
        img.save(&test_path).ok();

        let result = generate_thumbnail(
            test_path.to_str().unwrap(),
            thumb_path.to_str().unwrap(),
            50,
        );
        assert!(result.is_err());

        // Cleanup
        let _ = std::fs::remove_file(&test_path);
        let _ = std::fs::remove_file(&thumb_path);
    }
}

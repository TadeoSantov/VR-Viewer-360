use crate::errors::Result;
use image::{RgbImage, GenericImageView};

/// Información de un cubemap procesado
#[derive(Debug, Clone)]
pub struct CubemapInfo {
    pub face_size: u32,
    pub faces: Vec<String>, // Rutas a los archivos de caras
}

/// Valida que todas las 6 caras del cubemap existan y sean del tamaño correcto
pub fn validate_cubemap(output_dir: &str, face_size: u32) -> Result<CubemapInfo> {
    let faces = vec![
        "px.jpg", "nx.jpg", "py.jpg", "ny.jpg", "pz.jpg", "nz.jpg",
    ];

    let mut face_paths = Vec::new();
    for face_name in &faces {
        let path = format!("{}/{}", output_dir, face_name);
        if !std::path::Path::new(&path).exists() {
            return Err(crate::errors::ImageProcessorError::ProcessingError(
                format!("Missing cubemap face: {}", path),
            ));
        }

        let dynamic_img = image::open(&path)?;
        let (width, height) = dynamic_img.dimensions();
        if width != face_size || height != face_size {
            return Err(crate::errors::ImageProcessorError::InvalidDimensions(
                format!(
                    "Face {} has incorrect dimensions: {}x{}, expected {}x{}",
                    face_name, width, height, face_size, face_size
                ),
            ));
        }

        face_paths.push(path);
    }

    Ok(CubemapInfo {
        face_size,
        faces: face_paths,
    })
}

/// Descala una imagen RGB manteniendo aspecto
pub fn downscale_image(image: &RgbImage, target_width: u32, target_height: u32) -> RgbImage {
    use image::imageops;
    imageops::resize(image, target_width, target_height, image::imageops::FilterType::Lanczos3)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_downscale_image() {
        let mut img = RgbImage::new(100, 100);
        for pixel in img.pixels_mut() {
            *pixel = image::Rgb([255, 128, 64]);
        }

        let scaled = downscale_image(&img, 50, 50);
        assert_eq!(scaled.width(), 50);
        assert_eq!(scaled.height(), 50);
    }
}

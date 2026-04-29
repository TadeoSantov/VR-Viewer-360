use crate::errors::Result;
use crate::types::{Vector3, CubemapFace};
use image::RgbImage;
use std::f32::consts::PI;

/// Proyecta coordenadas 2D de una cara del cubemap a un vector 3D
fn cubemap_coords_to_vector(face: CubemapFace, u: f32, v: f32) -> Vector3 {
    // u, v normalizados a [-1, 1]
    let u = u * 2.0 - 1.0;
    let v = v * 2.0 - 1.0;

    match face {
        CubemapFace::PositiveX => Vector3::new(1.0, -v, -u),
        CubemapFace::NegativeX => Vector3::new(-1.0, -v, u),
        CubemapFace::PositiveY => Vector3::new(u, 1.0, v),
        CubemapFace::NegativeY => Vector3::new(u, -1.0, -v),
        CubemapFace::PositiveZ => Vector3::new(u, -v, 1.0),
        CubemapFace::NegativeZ => Vector3::new(-u, -v, -1.0),
    }
}

/// Convierte un vector 3D a coordenadas equirectangulares (u, v)
fn vector_to_equirect(vec: Vector3) -> (f32, f32) {
    let vec = vec.normalize();
    
    // θ = atan2(z, x)
    // φ = acos(y)
    let theta = vec.z.atan2(vec.x);
    let phi = vec.y.acos();

    // Normalizar a [0, 1]
    let u = (theta + PI) / (2.0 * PI);
    let v = phi / PI;

    (u, v)
}

/// Muestreo bilineal de imagen
fn bilinear_sample(image: &RgbImage, u: f32, v: f32) -> image::Rgb<u8> {
    let width = image.width() as f32;
    let height = image.height() as f32;

    let x = u * width;
    let y = v * height;

    let x0 = x.floor() as u32;
    let x1 = (x0 + 1).min(image.width() - 1);
    let y0 = y.floor() as u32;
    let y1 = (y0 + 1).min(image.height() - 1);

    let fx = x - x0 as f32;
    let fy = y - y0 as f32;

    let p00 = image.get_pixel(x0, y0);
    let p10 = image.get_pixel(x1, y0);
    let p01 = image.get_pixel(x0, y1);
    let p11 = image.get_pixel(x1, y1);

    // Interpolación bilineal
    let r = (1.0 - fx) * (1.0 - fy) * p00[0] as f32
        + fx * (1.0 - fy) * p10[0] as f32
        + (1.0 - fx) * fy * p01[0] as f32
        + fx * fy * p11[0] as f32;

    let g = (1.0 - fx) * (1.0 - fy) * p00[1] as f32
        + fx * (1.0 - fy) * p10[1] as f32
        + (1.0 - fx) * fy * p01[1] as f32
        + fx * fy * p11[1] as f32;

    let b = (1.0 - fx) * (1.0 - fy) * p00[2] as f32
        + fx * (1.0 - fy) * p10[2] as f32
        + (1.0 - fx) * fy * p01[2] as f32
        + fx * fy * p11[2] as f32;

    image::Rgb([r as u8, g as u8, b as u8])
}

/// Procesa una cara del cubemap desde una imagen equirectangular
pub fn process_cubemap_face(
    equirect: &RgbImage,
    face: CubemapFace,
    face_size: u32,
) -> Result<RgbImage> {
    let mut output = RgbImage::new(face_size, face_size);

    for y in 0..face_size {
        for x in 0..face_size {
            // Coordenadas normalizadas en la cara [0, 1]
            let u = (x as f32 + 0.5) / face_size as f32;
            let v = (y as f32 + 0.5) / face_size as f32;

            // Convertir a vector 3D
            let vec = cubemap_coords_to_vector(face, u, v);

            // Convertir a coordenadas equirectangulares
            let (eq_u, eq_v) = vector_to_equirect(vec);

            // Muestrear con interpolación bilineal
            let pixel = bilinear_sample(equirect, eq_u, eq_v);
            output.put_pixel(x, y, pixel);
        }
    }

    Ok(output)
}

/// Genera todos los 6 cubemaps a partir de una imagen equirectangular
pub fn equirect_to_cubemap(
    input_path: &str,
    output_dir: &str,
    face_size: u32,
) -> Result<()> {
    // Cargar imagen equirectangular
    let equirect = image::open(input_path)?
        .to_rgb8();

    // Validar proporción 2:1
    let width = equirect.width();
    let height = equirect.height();
    if width != height * 2 {
        return Err(crate::errors::ImageProcessorError::InvalidDimensions(
            format!("Expected 2:1 ratio, got {}x{}", width, height),
        ));
    }

    // Crear directorio de salida si no existe
    std::fs::create_dir_all(output_dir)?;

    // Procesar cada cara
    for face in CubemapFace::all() {
        let face_image = process_cubemap_face(&equirect, face, face_size)?;
        let output_path = format!("{}/{}", output_dir, face.filename());
        face_image.save(&output_path)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_normalization() {
        let v = Vector3::new(3.0, 4.0, 0.0);
        let normalized = v.normalize();
        assert!((normalized.length() - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cubemap_to_vector() {
        let v = cubemap_coords_to_vector(CubemapFace::PositiveX, 0.5, 0.5);
        assert!((v.x - 1.0).abs() < 0.001);
    }
}

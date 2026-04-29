use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Size {
    pub width: u32,
    pub height: u32,
}

impl Size {
    pub fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }

    pub fn total_pixels(&self) -> u64 {
        self.width as u64 * self.height as u64
    }
}

#[derive(Debug, Clone, Copy)]
pub enum CubemapFace {
    PositiveX, // px
    NegativeX, // nx
    PositiveY, // py
    NegativeY, // ny
    PositiveZ, // pz
    NegativeZ, // nz
}

impl CubemapFace {
    pub fn filename(&self) -> &'static str {
        match self {
            CubemapFace::PositiveX => "px.jpg",
            CubemapFace::NegativeX => "nx.jpg",
            CubemapFace::PositiveY => "py.jpg",
            CubemapFace::NegativeY => "ny.jpg",
            CubemapFace::PositiveZ => "pz.jpg",
            CubemapFace::NegativeZ => "nz.jpg",
        }
    }

    pub fn all() -> [Self; 6] {
        [
            CubemapFace::PositiveX,
            CubemapFace::NegativeX,
            CubemapFace::PositiveY,
            CubemapFace::NegativeY,
            CubemapFace::PositiveZ,
            CubemapFace::NegativeZ,
        ]
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Vector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vector3 {
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn normalize(&self) -> Self {
        let len = self.length();
        if len > 0.0 {
            Self {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
            }
        } else {
            *self
        }
    }
}

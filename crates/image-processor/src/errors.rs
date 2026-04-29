use thiserror::Error;
use std::io;

#[derive(Error, Debug)]
pub enum ImageProcessorError {
    #[error("IO error: {0}")]
    IoError(#[from] io::Error),

    #[error("Image error: {0}")]
    ImageError(String),

    #[error("Invalid dimensions: {0}")]
    InvalidDimensions(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Processing error: {0}")]
    ProcessingError(String),
}

impl From<image::ImageError> for ImageProcessorError {
    fn from(err: image::ImageError) -> Self {
        ImageProcessorError::ImageError(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, ImageProcessorError>;

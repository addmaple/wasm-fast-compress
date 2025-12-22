use core_api::{CompressionOptions, Compressor, Flush};
use flate2::Compression;
use std::io::Write;

/// Error type for gzip compression.
#[derive(Debug)]
pub enum GzipError {
    Io(std::io::Error),
    Other(String),
}

impl std::fmt::Display for GzipError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GzipError::Io(e) => write!(f, "IO error: {}", e),
            GzipError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for GzipError {}

impl From<std::io::Error> for GzipError {
    fn from(e: std::io::Error) -> Self {
        GzipError::Io(e)
    }
}

/// Gzip/deflate compressor.
pub struct GzipCompressor {
    encoder: flate2::write::GzEncoder<Vec<u8>>,
    finished: bool,
}

impl Compressor for GzipCompressor {
    type Error = GzipError;

    fn new(options: CompressionOptions) -> Result<Self, Self::Error> {
        let level = options.level.unwrap_or(6);
        let compression = match level {
            0 => Compression::none(),
            l if l <= 9 => Compression::new(l as u32),
            _ => Compression::best(),
        };

        let encoder = flate2::write::GzEncoder::new(Vec::new(), compression);
        Ok(Self {
            encoder,
            finished: false,
        })
    }

    fn compress_chunk(
        &mut self,
        input: &[u8],
        flush: Flush,
    ) -> Result<Vec<u8>, Self::Error> {
        if self.finished {
            return Err(GzipError::Other("Cannot compress after finish".to_string()));
        }

        self.encoder.write_all(input)?;

        if matches!(flush, Flush::Finish) {
            self.finished = true;
            // finish() takes ownership, so we need to replace with a dummy encoder
            let encoder = std::mem::replace(
                &mut self.encoder,
                flate2::write::GzEncoder::new(Vec::new(), Compression::default()),
            );
            encoder.finish().map_err(GzipError::from)
        } else {
            self.encoder.flush()?;
            // Take the output from the inner Vec<u8>
            let mut output = Vec::new();
            std::mem::swap(self.encoder.get_mut(), &mut output);
            Ok(output)
        }
    }

    fn compress_all(
        input: &[u8],
        options: CompressionOptions,
    ) -> Result<Vec<u8>, Self::Error> {
        let level = options.level.unwrap_or(6);
        let compression = match level {
            0 => Compression::none(),
            l if l <= 9 => Compression::new(l as u32),
            _ => Compression::best(),
        };

        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), compression);
        encoder.write_all(input)?;
        encoder.finish().map_err(GzipError::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_all() {
        let input = b"hello world";
        let options = CompressionOptions::default();
        let compressed = GzipCompressor::compress_all(input, options).unwrap();
        assert!(!compressed.is_empty());
        // For very small inputs, compressed size may be larger due to headers
        // Just verify we got valid compressed output
        assert!(compressed.len() > 0);
    }

    #[test]
    fn test_streaming() {
        let mut compressor = GzipCompressor::new(CompressionOptions::default()).unwrap();
        let chunk1 = compressor.compress_chunk(b"hello ", Flush::None).unwrap();
        // With the flush optimization, we should get some data out even for small inputs
        // Gzip header is at least 10 bytes
        assert!(!chunk1.is_empty());
        let chunk2 = compressor.compress_chunk(b"world", Flush::Finish).unwrap();
        assert!(!chunk2.is_empty());
    }
}


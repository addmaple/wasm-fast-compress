use core_api::{CompressionOptions, Compressor, Flush};

/// Error type for LZ4 compression.
#[derive(Debug)]
pub enum Lz4Error {
    Other(String),
}

impl std::fmt::Display for Lz4Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Lz4Error::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for Lz4Error {}

/// LZ4 compressor.
/// Note: LZ4 doesn't have a native streaming API, so we accumulate input.
pub struct Lz4Compressor {
    buffer: Vec<u8>,
    finished: bool,
    level: u32,
}

impl Compressor for Lz4Compressor {
    type Error = Lz4Error;

    fn new(options: CompressionOptions) -> Result<Self, Self::Error> {
        let level = options.level.unwrap_or(4);
        Ok(Self {
            buffer: Vec::new(),
            finished: false,
            level,
        })
    }

    fn compress_chunk(
        &mut self,
        input: &[u8],
        flush: Flush,
    ) -> Result<Vec<u8>, Self::Error> {
        if self.finished {
            return Err(Lz4Error::Other("Cannot compress after finish".to_string()));
        }

        self.buffer.extend_from_slice(input);

        if matches!(flush, Flush::Finish) {
            self.finished = true;
            // Use frame::FrameEncoder to produce standard LZ4 frames
            use std::io::Write;
            let mut encoder = lz4_flex::frame::FrameEncoder::new(Vec::new());
            encoder.write_all(&self.buffer).map_err(|e| Lz4Error::Other(e.to_string()))?;
            let compressed = encoder.finish().map_err(|e| Lz4Error::Other(e.to_string()))?;
            Ok(compressed)
        } else {
            // LZ4 doesn't support partial compression, so return empty until finish
            Ok(Vec::new())
        }
    }

    fn compress_all(
        input: &[u8],
        _options: CompressionOptions,
    ) -> Result<Vec<u8>, Self::Error> {
        // Use frame::FrameEncoder to produce standard LZ4 frames compatible with other libraries
        use std::io::Write;
        let mut encoder = lz4_flex::frame::FrameEncoder::new(Vec::new());
        encoder.write_all(input).map_err(|e| Lz4Error::Other(e.to_string()))?;
        let compressed = encoder.finish().map_err(|e| Lz4Error::Other(e.to_string()))?;
        Ok(compressed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_all() {
        let input = b"hello world";
        let options = CompressionOptions::default();
        let compressed = Lz4Compressor::compress_all(input, options).unwrap();
        assert!(!compressed.is_empty());
    }

    #[test]
    fn test_streaming() {
        let mut compressor = Lz4Compressor::new(CompressionOptions::default()).unwrap();
        compressor.compress_chunk(b"hello ", Flush::None).unwrap();
        let result = compressor.compress_chunk(b"world", Flush::Finish).unwrap();
        assert!(!result.is_empty());
    }
}


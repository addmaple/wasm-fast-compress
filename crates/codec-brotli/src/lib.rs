use core_api::{CompressionOptions, Compressor, Flush};
use std::io::Write;

/// Error type for brotli compression.
#[derive(Debug)]
pub enum BrotliError {
    Io(std::io::Error),
    Other(String),
}

impl std::fmt::Display for BrotliError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BrotliError::Io(e) => write!(f, "IO error: {}", e),
            BrotliError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for BrotliError {}

impl From<std::io::Error> for BrotliError {
    fn from(e: std::io::Error) -> Self {
        BrotliError::Io(e)
    }
}

/// Brotli compressor.
pub struct BrotliCompressor {
    encoder: brotli::CompressorWriter<Vec<u8>>,
    finished: bool,
}

impl Compressor for BrotliCompressor {
    type Error = BrotliError;

    fn new(options: CompressionOptions) -> Result<Self, Self::Error> {
        let level = options.level.unwrap_or(6);
        let params = brotli::enc::BrotliEncoderParams {
            quality: level as i32,
            ..Default::default()
        };
        let encoder = brotli::CompressorWriter::with_params(
            Vec::new(),
            4096,
            &params,
        );
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
            return Err(BrotliError::Other("Cannot compress after finish".to_string()));
        }

        self.encoder.write_all(input)?;

        if matches!(flush, Flush::Finish) {
            self.finished = true;
            self.encoder.flush()?;
            let buffer = std::mem::take(self.encoder.get_mut());
            Ok(buffer)
        } else {
            Ok(Vec::new())
        }
    }

    fn compress_all(
        input: &[u8],
        options: CompressionOptions,
    ) -> Result<Vec<u8>, Self::Error> {
        let level = options.level.unwrap_or(6);
        let params = brotli::enc::BrotliEncoderParams {
            quality: level as i32,
            ..Default::default()
        };
        let mut encoder = brotli::CompressorWriter::with_params(
            Vec::new(),
            4096,
            &params,
        );
        encoder.write_all(input)?;
        encoder.flush()?;
        // Use into_inner to finalize the stream and get the buffer
        // Dropping the encoder finalizes the stream
        let buffer = encoder.into_inner();
        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_all() {
        let input = b"hello world";
        let options = CompressionOptions::default();
        let compressed = BrotliCompressor::compress_all(input, options).unwrap();
        assert!(!compressed.is_empty());
    }

    #[test]
    fn test_streaming() {
        let mut compressor = BrotliCompressor::new(CompressionOptions::default()).unwrap();
        compressor.compress_chunk(b"hello ", Flush::None).unwrap();
        let result = compressor.compress_chunk(b"world", Flush::Finish).unwrap();
        assert!(!result.is_empty());
    }
}


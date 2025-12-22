/// Core traits and types for compression codecs.

/// Flush mode for streaming compression.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flush {
    /// Continue compressing, don't flush output yet.
    None,
    /// Finish the stream and flush all remaining output.
    Finish,
}

/// Compression options common across codecs.
#[derive(Debug, Clone)]
pub struct CompressionOptions {
    /// Compression level (codec-specific mapping).
    /// Higher values typically mean better compression but slower.
    pub level: Option<u32>,
    /// Window size logarithm (for codecs that support it).
    pub window_log: Option<u32>,
    /// Number of threads (may be ignored in WASM).
    pub threads: u8,
    /// Whether to enable SIMD optimizations if available.
    pub enable_simd: bool,
}

impl Default for CompressionOptions {
    fn default() -> Self {
        Self {
            level: None,
            window_log: None,
            threads: 1,
            enable_simd: true,
        }
    }
}

/// Core trait for compression codecs.
pub trait Compressor {
    /// Error type for this codec.
    type Error: std::error::Error + Send + Sync + 'static;

    /// Create a new compressor with the given options.
    fn new(options: CompressionOptions) -> Result<Self, Self::Error>
    where
        Self: Sized;

    /// Compress a chunk of input.
    ///
    /// - `input`: next slice to compress
    /// - `flush`: whether this chunk completes the stream
    ///
    /// Returns a buffer containing *all* produced output bytes for this call.
    fn compress_chunk(
        &mut self,
        input: &[u8],
        flush: Flush,
    ) -> Result<Vec<u8>, Self::Error>;

    /// Convenience non-streaming compression: one-shot.
    fn compress_all(
        input: &[u8],
        options: CompressionOptions,
    ) -> Result<Vec<u8>, Self::Error>
    where
        Self: Sized;
}






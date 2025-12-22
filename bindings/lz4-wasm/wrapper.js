import { 
  compress_lz4, 
  compress_lz4_block,
  decompress_lz4,
  decompress_lz4_block,
  wasmExports,
  alloc,
  free,
  memoryU8,
  ensureReady
} from './core.js';

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError("Expected a TypedArray or ArrayBuffer");
}

// ============================================================================
// Block API - Maximum speed, no frame overhead
// Output is NOT compatible with standard LZ4 tools (lz4 CLI, etc.)
// Use when you control both compression and decompression
// ============================================================================

/**
 * Compress using raw LZ4 block format (maximum speed)
 * ~5x faster than frame API due to no checksumming overhead
 * @param {Uint8Array} input - Data to compress
 * @returns {Promise<Uint8Array>} Compressed data (raw block format)
 */
export async function compressBlock(input) {
  try {
    return compress_lz4_block(input);
  } catch (error) {
    throw new Error(`Block compression failed: ${error.message}`);
  }
}

/**
 * Decompress raw LZ4 block format
 * @param {Uint8Array} input - Compressed data (raw block format)
 * @param {number} originalSize - Original uncompressed size (REQUIRED)
 * @returns {Promise<Uint8Array>} Decompressed data
 */
export async function decompressBlock(input, originalSize) {
  if (typeof originalSize !== 'number' || originalSize <= 0) {
    throw new Error('decompressBlock requires originalSize parameter');
  }
  await ensureReady();
  
  const view = toBytes(input);
  const len = view.byteLength;
  
  const inPtr = alloc(len);
  const outPtr = alloc(originalSize);
  
  try {
    memoryU8().set(view, inPtr);
    const written = wasmExports().decompress_lz4_block(inPtr, len, outPtr, originalSize);
    
    if (written < 0) {
      throw new Error('Block decompression failed');
    }
    
    const result = memoryU8().slice(outPtr, outPtr + written);
    return result;
  } finally {
    free(inPtr, len);
    free(outPtr, originalSize);
  }
}

// ============================================================================
// Packed Block API - Block format with size prefix (self-contained)
// Perfect for network transfer when you control both client and server
// Format: [4 bytes: original size (little-endian)] + [compressed data]
// ============================================================================

/**
 * Compress with size prefix - ready for network transfer
 * Output includes original size, so decompression doesn't need it separately
 * @param {Uint8Array} input - Data to compress
 * @returns {Promise<Uint8Array>} [4-byte size prefix] + [compressed block]
 */
export async function compressPacked(input) {
  const view = toBytes(input);
  const compressed = await compressBlock(view);
  
  // Prepend 4-byte little-endian size
  const result = new Uint8Array(4 + compressed.length);
  const dataView = new DataView(result.buffer);
  dataView.setUint32(0, view.length, true); // little-endian
  result.set(compressed, 4);
  
  return result;
}

/**
 * Decompress packed format (with size prefix)
 * @param {Uint8Array} input - Packed compressed data (from compressPacked)
 * @returns {Promise<Uint8Array>} Decompressed data
 */
export async function decompressPacked(input) {
  const view = toBytes(input);
  if (view.length < 4) {
    throw new Error('Invalid packed data: too short');
  }
  
  const dataView = new DataView(view.buffer, view.byteOffset, view.byteLength);
  const originalSize = dataView.getUint32(0, true); // little-endian
  const compressed = view.subarray(4);
  
  return decompressBlock(compressed, originalSize);
}

// ============================================================================
// Frame API - Standard LZ4 frame format (compatible with lz4 CLI tools)
// Includes headers and checksums for integrity
// ============================================================================

/**
 * Compress using standard LZ4 frame format
 * Compatible with lz4 CLI and other standard tools
 * @param {Uint8Array} input - Data to compress
 * @returns {Promise<Uint8Array>} Compressed data (LZ4 frame format)
 */
export async function compress(input) {
  try {
    return compress_lz4(input);
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

// Streaming compression API
// 
// Note: We don't use wasm-bindgen-lite's createTransformStream() helper here because
// compression/decompression requires stateful streaming:
// - Compression: Must accumulate input chunks until finish() is called
// - Decompression: Must handle partial frames and buffer incomplete data
// 
// createTransformStream() is designed for stateless transformations where each chunk
// is processed independently. Instead, we use a manual handle-based approach that:
// 1. Creates compressor/decompressor handles in Rust (stateful)
// 2. Maintains state between chunks via handles
// 3. Manually manages WASM memory allocation/freeing
export class StreamingCompressor {
  constructor() {
    this._initPromise = ensureReady();
    this.handle = null;
  }

  async _ensureInit() {
    await this._initPromise;
    if (this.handle === null) {
      this.handle = wasmExports().create_compressor();
      if (this.handle === 0) {
        throw new Error('Failed to create compressor');
      }
    }
  }

  async compressChunk(input, finish = false) {
    await this._ensureInit();
    if (this.handle === 0) {
      throw new Error('Compressor already destroyed');
    }
    
    const view = toBytes(input);
    const len = view.byteLength;
    const outLen = len + 1024; // LZ4 compression typically produces smaller output
    
    const inPtr = alloc(len);
    const outPtr = alloc(outLen);
    
    try {
      memoryU8().set(view, inPtr);
      const written = wasmExports().compress_chunk(this.handle, inPtr, len, outPtr, outLen, finish ? 1 : 0);
      
      if (written < 0) {
        if (written === -1) {
          throw new Error('Compression failed');
        } else {
          // Negative value indicates needed buffer size
          free(outPtr, outLen);
          const neededLen = -written;
          const newOutPtr = alloc(neededLen);
          memoryU8().set(view, inPtr);
          const retryWritten = wasmExports().compress_chunk(this.handle, inPtr, len, newOutPtr, neededLen, finish ? 1 : 0);
          if (retryWritten < 0) {
            free(newOutPtr, neededLen);
            throw new Error('Compression failed after retry');
          }
          const result = memoryU8().slice(newOutPtr, newOutPtr + retryWritten);
          free(newOutPtr, neededLen);
          free(inPtr, len);
          if (finish) {
            this.handle = 0;
          }
          return result;
        }
      }
      
      if (written === 0) {
        // No output yet (buffering)
        free(outPtr, outLen);
        free(inPtr, len);
        return new Uint8Array(0);
      }
      
      const result = memoryU8().slice(outPtr, outPtr + written);
      free(outPtr, outLen);
      free(inPtr, len);
      
      if (finish) {
        this.handle = 0;
      }
      
      return result;
    } catch (error) {
      free(outPtr, outLen);
      free(inPtr, len);
      throw new Error(`Compression failed: ${error.message}`);
    }
  }

  async destroy() {
    await this._ensureInit();
    if (this.handle !== 0 && this.handle !== null) {
      wasmExports().destroy_compressor(this.handle);
      this.handle = 0;
    }
  }
}

// Streaming decompression API
// 
// See note above about why we use manual handles instead of createTransformStream()
export class StreamingDecompressor {
  constructor() {
    this._initPromise = ensureReady();
    this.handle = null;
  }

  async _ensureInit() {
    await this._initPromise;
    if (this.handle === null) {
      this.handle = wasmExports().create_decompressor();
      if (this.handle === 0) {
        throw new Error('Failed to create decompressor');
      }
    }
  }

  async decompressChunk(input, finish = false) {
    await this._ensureInit();
    if (this.handle === 0) {
      throw new Error('Decompressor already destroyed');
    }
    
    const view = toBytes(input);
    const len = view.byteLength;
    const outLen = len * 4; // Decompressed data is typically larger
    
    const inPtr = alloc(len);
    const outPtr = alloc(outLen);
    
    try {
      memoryU8().set(view, inPtr);
      const written = wasmExports().decompress_chunk(this.handle, inPtr, len, outPtr, outLen, finish ? 1 : 0);
      
      if (written < 0) {
        if (written === -1) {
          throw new Error('Decompression failed');
        } else {
          // Negative value indicates needed buffer size
          free(outPtr, outLen);
          const neededLen = -written;
          const newOutPtr = alloc(neededLen);
          memoryU8().set(view, inPtr);
          const retryWritten = wasmExports().decompress_chunk(this.handle, inPtr, len, newOutPtr, neededLen, finish ? 1 : 0);
          if (retryWritten < 0) {
            free(newOutPtr, neededLen);
            throw new Error('Decompression failed after retry');
          }
          const result = memoryU8().slice(newOutPtr, newOutPtr + retryWritten);
          free(newOutPtr, neededLen);
          free(inPtr, len);
          if (finish) {
            this.handle = 0;
          }
          return result;
        }
      }
      
      if (written === 0) {
        // No output yet (buffering)
        free(outPtr, outLen);
        free(inPtr, len);
        return new Uint8Array(0);
      }
      
      const result = memoryU8().slice(outPtr, outPtr + written);
      free(outPtr, outLen);
      free(inPtr, len);
      
      if (finish) {
        this.handle = 0;
      }
      
      return result;
    } catch (error) {
      free(outPtr, outLen);
      free(inPtr, len);
      throw new Error(`Decompression failed: ${error.message}`);
    }
  }

  async destroy() {
    await this._ensureInit();
    if (this.handle !== 0 && this.handle !== null) {
      wasmExports().destroy_decompressor(this.handle);
      this.handle = 0;
    }
  }
}

// One-shot decompression
export async function decompress(input) {
  try {
    return decompress_lz4(input);
  } catch (error) {
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

export { wasmExports };


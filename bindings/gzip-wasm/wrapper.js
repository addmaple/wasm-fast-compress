import { 
  compress_level_1, 
  compress_level_6, 
  compress_level_9,
  decompress_gzip,
  create_gzip_compressor,
  compress_gzip_chunk,
  destroy_gzip_compressor,
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
// One-shot Compression API
// ============================================================================

export async function compress(input, options = {}) {
  const level = options.level ?? 6;
  
  try {
    if (level <= 1) return compress_level_1(input);
    if (level <= 6) return compress_level_6(input);
    return compress_level_9(input);
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

// ============================================================================
// One-shot Decompression API
// ============================================================================

export async function decompress(input) {
  await ensureReady();
  
  const view = toBytes(input);
  const len = view.byteLength;
  
  // Start with a reasonable estimate (10x compressed size)
  let outLen = Math.max(len * 10, 65536);
  
  const inPtr = alloc(len);
  let outPtr = alloc(outLen);
  
  try {
    memoryU8().set(view, inPtr);
    let written = wasmExports().decompress_gzip(inPtr, len, outPtr, outLen);
    
    // Negative value means we need more space
    if (written < 0) {
      const neededLen = -written;
      free(outPtr, outLen);
      outLen = neededLen;
      outPtr = alloc(outLen);
      
      // Retry with correct size
      written = wasmExports().decompress_gzip(inPtr, len, outPtr, outLen);
      
      if (written < 0) {
        throw new Error('Decompression failed after resize');
      }
    }
    
    const result = memoryU8().slice(outPtr, outPtr + written);
    free(inPtr, len);
    free(outPtr, outLen);
    return result;
  } catch (error) {
    free(inPtr, len);
    free(outPtr, outLen);
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

// ============================================================================
// Streaming Compression API
// ============================================================================

export class StreamingCompressor {
  constructor(options = {}) {
    this._initPromise = ensureReady();
    this.level = options.level ?? 6;
    this.handle = null;
  }

  async _ensureInit() {
    await this._initPromise;
    if (this.handle === null) {
      this.handle = wasmExports().create_gzip_compressor(this.level);
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
    const outLen = len + 1024;
    
    const inPtr = alloc(len);
    const outPtr = alloc(outLen);
    
    try {
      memoryU8().set(view, inPtr);
      const written = wasmExports().compress_gzip_chunk(this.handle, inPtr, len, outPtr, outLen, finish ? 1 : 0);
      
      if (written < 0) {
        if (written === -1) {
          throw new Error('Compression failed');
        } else {
          // Negative value indicates needed buffer size
          free(outPtr, outLen);
          const neededLen = -written;
          const newOutPtr = alloc(neededLen);
          memoryU8().set(view, inPtr);
          const retryWritten = wasmExports().compress_gzip_chunk(this.handle, inPtr, len, newOutPtr, neededLen, finish ? 1 : 0);
          if (retryWritten < 0) {
            free(newOutPtr, neededLen);
            throw new Error('Compression failed after retry');
          }
          const result = memoryU8().slice(newOutPtr, newOutPtr + retryWritten);
          free(newOutPtr, neededLen);
          free(inPtr, len);
          if (finish) this.handle = 0;
          return result;
        }
      }
      
      if (written === 0) {
        free(outPtr, outLen);
        free(inPtr, len);
        return new Uint8Array(0);
      }
      
      const result = memoryU8().slice(outPtr, outPtr + written);
      free(outPtr, outLen);
      free(inPtr, len);
      
      if (finish) this.handle = 0;
      return result;
    } catch (error) {
      free(outPtr, outLen);
      free(inPtr, len);
      throw new Error(`Compression failed: ${error.message}`);
    }
  }

  async destroy() {
    await this._initPromise;
    if (this.handle !== 0 && this.handle !== null) {
      wasmExports().destroy_gzip_compressor(this.handle);
      this.handle = 0;
    }
  }
}

// ============================================================================
// Streaming Decompression API (WASM)
// ============================================================================

export class StreamingDecompressor {
  constructor() {
    this._initPromise = ensureReady();
    this.handle = null;
  }

  async _ensureInit() {
    await this._initPromise;
    if (this.handle === null) {
      this.handle = wasmExports().create_gzip_decompressor();
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

    // Heuristic: gzip can expand a lot; start with a decent minimum.
    const outLen = Math.max(len * 8, 65536);

    const inPtr = alloc(len);
    const outPtr = alloc(outLen);

    try {
      memoryU8().set(view, inPtr);
      const written = wasmExports().decompress_gzip_chunk(
        this.handle,
        inPtr,
        len,
        outPtr,
        outLen,
        finish ? 1 : 0
      );

      if (written < 0) {
        throw new Error('Decompression failed');
      }

      if (written === 0) {
        free(inPtr, len);
        free(outPtr, outLen);
        if (finish) this.handle = 0;
        return new Uint8Array(0);
      }

      const result = memoryU8().slice(outPtr, outPtr + written);
      free(inPtr, len);
      free(outPtr, outLen);

      if (finish) this.handle = 0;
      return result;
    } catch (error) {
      free(inPtr, len);
      free(outPtr, outLen);
      throw new Error(`Decompression failed: ${error.message}`);
    }
  }

  async destroy() {
    await this._initPromise;
    if (this.handle !== 0 && this.handle !== null) {
      wasmExports().destroy_gzip_decompressor(this.handle);
      this.handle = 0;
    }
  }
}

// ============================================================================
// Ergonomic streaming helpers (Web Streams)
// ============================================================================

function requireTransformStream() {
  if (typeof TransformStream === 'undefined') {
    throw new Error('TransformStream is not available in this runtime');
  }
}

/**
 * Create a TransformStream that gzip-compresses a byte stream.
 *
 * @param {{ level?: number }} [options]
 * @returns {TransformStream<Uint8Array, Uint8Array>}
 */
export function createCompressionStream(options = {}) {
  requireTransformStream();
  const gz = new StreamingCompressor(options);

  return new TransformStream({
    async transform(chunk, controller) {
      const out = await gz.compressChunk(toBytes(chunk), false);
      if (out.length) controller.enqueue(out);
    },
    async flush(controller) {
      const out = await gz.compressChunk(new Uint8Array(0), true);
      if (out.length) controller.enqueue(out);
    },
  });
}

/**
 * Create a TransformStream that gzip-decompresses a byte stream.
 *
 * @returns {TransformStream<Uint8Array, Uint8Array>}
 */
export function createDecompressionStream() {
  requireTransformStream();
  const dec = new StreamingDecompressor();

  async function drain(controller, finish) {
    // Drain any remaining output buffered on the Rust side.
    while (true) {
      const out = await dec.decompressChunk(new Uint8Array(0), finish);
      if (!out.length) break;
      controller.enqueue(out);
      // Only pass finish once; subsequent drains should be finish=false.
      finish = false;
    }
  }

  return new TransformStream({
    async transform(chunk, controller) {
      const out = await dec.decompressChunk(toBytes(chunk), false);
      if (out.length) controller.enqueue(out);
      await drain(controller, false);
    },
    async flush(controller) {
      // Finish and drain the remainder.
      await drain(controller, true);
    },
  });
}

/**
 * Convenience helper: readable.pipeThrough(createCompressionStream()).
 * @param {ReadableStream<Uint8Array>} readable
 * @param {{ level?: number }} [options]
 */
export function compressStream(readable, options = {}) {
  return readable.pipeThrough(createCompressionStream(options));
}

/**
 * Convenience helper: readable.pipeThrough(createDecompressionStream()).
 * @param {ReadableStream<Uint8Array>} readable
 */
export function decompressStream(readable) {
  return readable.pipeThrough(createDecompressionStream());
}

export { wasmExports };


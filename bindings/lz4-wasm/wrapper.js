import { compress_lz4, wasmExports } from './core.js';

// LZ4 is a single-speed algorithm optimized for maximum throughput.
// Unlike Brotli/Gzip, it doesn't have compression levels.
export async function compress(input) {
  try {
    return compress_lz4(input);
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

export { wasmExports };


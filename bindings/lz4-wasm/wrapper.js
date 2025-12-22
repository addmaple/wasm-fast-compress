import { compress_level_1, compress_level_9, wasmExports } from './core.js';

export async function compress(input, options = {}) {
  const level = options.level ?? 1;
  
  try {
    if (level <= 1) return compress_level_1(input);
    return compress_level_9(input);
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

export { wasmExports };

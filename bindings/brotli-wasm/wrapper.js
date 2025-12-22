import { compress_level_1, compress_level_4, compress_level_6, compress_level_9, wasmExports } from './core.js';

export async function compress(input, options = {}) {
  const level = options.level ?? 9;
  
  try {
    if (level <= 1) return compress_level_1(input);
    if (level <= 4) return compress_level_4(input);
    if (level <= 6) return compress_level_6(input);
    return compress_level_9(input);
  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

export function getLoadedVariant() {
  return 'lite';
}

export { wasmExports };

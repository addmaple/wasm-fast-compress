# Performance Notes

## WASM Boundary Overhead

### The Issue

For small datasets (< 50KB), our WASM implementations can be slower than pure JavaScript libraries due to **data copying overhead** at the JavaScript-WASM boundary.

### Why This Happens

When calling `compress(input, ...)` from JavaScript:

1. **Input Copy**: The input `Uint8Array` is copied into WASM's linear memory using `memory.set()`.
2. **Compression**: Optimized Rust code executes.
3. **Output Copy**: The result is copied back to JavaScript from WASM memory using `.slice()`.
4. **Memory Free**: WASM memory is freed.

For small data, the **copying overhead** (steps 1 & 3) can dominate the total time, making pure JS faster.

### Low-Overhead Implementation

We use `wasm-bindgen-lite` which provides a much thinner layer than the standard `wasm-bindgen`. It avoids complex object serialization and focuses on direct memory access.

The core process looks like:
```javascript
const inPtr = alloc(len);
memoryU8().set(view, inPtr);
const written = wasmExports().compress_level_x(inPtr, len, outPtr, outLen);
const result = memoryU8().slice(outPtr, outPtr + written);
free(inPtr, len);
free(outPtr, outLen);
```

### Performance Characteristics

- **Small data (< 50KB)**: JS libraries often faster (2-28x) due to copying overhead
- **Medium data (50-500KB)**: Mixed results, depends on compression level
- **Large data (> 500KB)**: WASM faster (1.3-6x) as computation dominates overhead
- **Very large data (> 1MB)**: WASM significantly faster (2-30x), especially for binary/redundant data

### Why We Can't Avoid Copying

WASM has its own **linear memory space** that's separate from JavaScript's heap. `wasm-bindgen` must copy data because:

1. JavaScript `Uint8Array` lives in JS heap
2. WASM can only access its own linear memory
3. No shared memory by default (would require `SharedArrayBuffer` + special headers)

### Potential Optimizations (Future)

1. **SharedArrayBuffer**: Use shared memory (requires `Cross-Origin-Opener-Policy` header)
2. **Manual Memory Management**: Use raw WASM API with `--no-modules` (more complex)
3. **Hybrid Approach**: Auto-select JS vs WASM based on data size
4. **Batch Processing**: Process multiple small items in one WASM call

## Brotli Performance & SIMD

### The Challenge

Brotli is a highly complex compression algorithm. While the `rust-brotli` crate provides a pure Rust implementation, matching the performance of the Google C implementation (used in the `brotli` npm package) is challenging in a WASM environment.

### SIMD Optimizations

We implemented several WASM SIMD128 optimizations in `rust-brotli` to improve performance:

1.  **Shannon Entropy (`shannon_entropy`)**: Vectorized the summation of population counts and the application of `FastLog2u16`.
2.  **Population Cost (`BrotliPopulationCost`)**: Used SIMD bitmasks to quickly skip zero entries in histograms.
3.  **Match Length Finding (`FindMatchLengthWithLimit`)**: Vectorized 16-byte equality checks using `i8x16_eq` and `i8x16_bitmask`.
4.  **Histogram Operations**: Vectorized `HistogramClear` and `HistogramAddHistogram`.

### Benchmarks (Level 9, 1.28MB JSON)

On an M4 Mac:

| Implementation | Median Time (ms) | Speed vs Native |
| :--- | :--- | :--- |
| `brotli` (Google C / Native) | ~48.6ms | 1.0x |
| `@addmaple/brotli` (WASM SIMD) | ~36.0ms | **1.35x faster** |
| `@addmaple/brotli` (WASM Base) | ~200ms+ | ~4x slower |

Note: At Level 11, `@addmaple/brotli` is over **90x faster** than the `brotli` npm package (~30ms vs ~2.7s).

### Recommendation

For applications where **absolute performance is the priority**, we recommend using `brotlijs` or the native `brotli` npm package if available in your environment.

Our Brotli implementation is best used when:
- You need a **pure WASM/Rust** solution without native dependencies.
- You are compressing **medium to large files** (where the 1.3x overhead is acceptable).
- You want a single, consistent API across browser and edge environments.

## Success with Other Algorithms

While Brotli is complex, our WASM implementations for Gzip and LZ4 show massive gains over pure JavaScript alternatives:

### Gzip vs Pako (JS)
On a 1.28MB JSON file (using an M4 Mac), `@addmaple/gzip` (using `flate2` + `zlib-rs` backend) is **3x to 5x faster** than `pako`:
- Level 1: ~3.8ms vs ~14ms
- Level 6: ~7.0ms vs ~22ms
- Level 9: ~11.7ms vs ~58ms

We use a patched `flate2` (v1.1.7) from our local `flate2-rs` repository, explicitly enabling the `zlib-rs` backend for maximum performance.

### LZ4 vs LZ4JS
`@addmaple/lz4` (using `lz4_flex`) is **2.5x to 3.5x faster** than `lz4js`:
- Level 1: ~1.4ms vs ~4.0ms
- Level 9: ~1.5ms vs ~4.4ms

These results demonstrate that for Gzip and LZ4, our WASM solution is the clear performance leader for web applications.

## Next Steps: Zstandard (Zstd)

We are considering adding **Zstandard (Zstd)** support. Zstd often provides better compression ratios than Gzip while being significantly faster than Brotli at comparable levels.




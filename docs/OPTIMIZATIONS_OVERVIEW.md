# Codec Optimizations Overview

This directory contains comprehensive documentation explaining how each compression codec was optimized for WebAssembly, with a focus on SIMD optimizations and safety guarantees.

## Documentation Index

- **[Brotli Optimizations](./BROTLI_OPTIMIZATIONS.md)** - Detailed explanation of Brotli SIMD optimizations
- **[Gzip Optimizations](./GZIP_OPTIMIZATIONS.md)** - Gzip backend selection and SIMD usage
- **[LZ4 Optimizations](./LZ4_OPTIMIZATIONS.md)** - LZ4 SIMD optimizations and safe-encode configuration

## Common Optimization Strategies

### 1. SIMD128 Vectorization

All three codecs leverage WebAssembly SIMD128 to process multiple data elements in parallel:

- **Brotli**: Custom SIMD optimizations in `rust-brotli` for entropy calculation, histogram operations, and string matching
- **Gzip**: Uses `zlib-rs` backend which includes SIMD-optimized hash tables and string matching
- **LZ4**: Uses `lz4_flex` with SIMD-optimized hash function computation, hash table operations, and memory operations

### 2. Build-Time Feature Selection

Each codec uses conditional compilation to enable SIMD:

- **Brotli**: Separate `brotli-base.wasm` and `brotli-simd.wasm` binaries
- **Gzip**: Separate `gzip-base.wasm` and `gzip-simd.wasm` binaries
- **LZ4**: Separate `lz4-base.wasm` and `lz4-simd.wasm` binaries

### 3. Runtime SIMD Detection

The JavaScript wrapper automatically detects SIMD support and loads the appropriate binary:

```javascript
const hasSIMD = WebAssembly.validate(new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 11
]));
const wasmFile = hasSIMD ? 'codec-simd.wasm' : 'codec-base.wasm';
```

## Safety Guarantees

All SIMD optimizations maintain safety through:

1. **Bounds Checking**: All memory accesses are validated before SIMD operations
2. **Alignment Handling**: WASM SIMD128 handles unaligned memory safely
3. **Fallback Paths**: Scalar code provides identical functionality when SIMD unavailable
4. **Type Safety**: Explicit casts with validation
5. **Testing**: Extensive test suites ensure correctness

## Performance Summary

| Codec | vs JS Alternative | SIMD Speedup | Key Optimization |
|-------|------------------|-------------|------------------|
| **Brotli** | 1.35x faster (vs native C) | ~5.5x (vs base) | Custom SIMD entropy & matching |
| **Gzip** | 3.5x-5.5x faster (vs pako) | ~1.5-2x (vs miniz_oxide) | zlib-rs backend with SIMD |
| **LZ4** | 2.5x-3.5x faster (vs lz4js) | ~1.5-2x (vs base) | SIMD hash function & hash tables |

## Why SIMD Works

SIMD (Single Instruction, Multiple Data) allows processing multiple values in parallel:

1. **Parallel Operations**: Instead of processing one element at a time, SIMD processes 4-16 elements simultaneously
2. **Reduced Loop Overhead**: Fewer loop iterations mean less overhead
3. **Better Cache Usage**: SIMD operations are cache-friendly
4. **Hardware Acceleration**: Modern CPUs have dedicated SIMD execution units

## Why It's Safe

### Memory Safety

- **Bounds Checking**: All SIMD operations check array bounds first
- **Alignment**: WASM SIMD128 handles unaligned memory safely
- **Type Safety**: Explicit type conversions with validation

### Correctness

- **Reference Implementation**: All optimizations verified against reference implementations
- **Compatibility**: Produces bit-identical output to standard tools
- **Testing**: Extensive test suites including fuzzing

### Platform Compatibility

- **Feature Detection**: SIMD code gated by compile-time and runtime checks
- **Graceful Degradation**: Non-SIMD builds work identically, just slower
- **WASM Compatibility**: Fully compatible with WebAssembly standards

## Common SIMD Patterns

### Pattern 1: Vectorized Summation

```rust
let mut sum_v = i32x4_splat(0);
while i < n_simd {
    let v = v128_load(data.as_ptr().add(i) as *const v128);
    sum_v = i32x4_add(sum_v, v);
    i += 4;
}
// Extract and sum lanes
```

### Pattern 2: Parallel Comparison

```rust
let a = v128_load(s1.as_ptr().add(i) as *const v128);
let b = v128_load(s2.as_ptr().add(i) as *const v128);
let eq = i8x16_eq(a, b);
let mask = i8x16_bitmask(eq);
if mask == 0xffff {
    // All match
} else {
    // Find first mismatch
}
```

### Pattern 3: Zero Detection

```rust
let zero = i32x4_splat(0);
let v = v128_load(data.as_ptr().add(i) as *const v128);
let mask_v = i32x4_gt(v, zero);
let mask_bits = i32x4_bitmask(mask_v);
// mask_bits indicates which elements are non-zero
```

## Build System Integration

The build system creates optimized WASM binaries:

1. **Base Build**: Stable Rust, no SIMD (compatible with all browsers)
2. **SIMD Build**: Nightly Rust with SIMD128 (faster, requires SIMD support)
3. **Automatic Selection**: JavaScript wrapper chooses appropriate binary

## Further Reading

- [WASM SIMD Specification](https://github.com/WebAssembly/simd)
- [Rust SIMD Documentation](https://doc.rust-lang.org/core/arch/)
- [WebAssembly SIMD Proposal](https://github.com/WebAssembly/simd/blob/main/proposals/simd/SIMD.md)

## Contributing

When adding new SIMD optimizations:

1. **Verify Correctness**: Test against reference implementation
2. **Check Bounds**: Ensure all memory accesses are bounds-checked
3. **Provide Fallback**: Include scalar code path
4. **Document Safety**: Explain why unsafe code is safe
5. **Benchmark**: Measure performance improvements


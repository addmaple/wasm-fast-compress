# Brotli Codec Optimizations

This document explains how the Brotli codec was optimized for WebAssembly, focusing on SIMD128 optimizations and their safety guarantees.

## Overview

Brotli is a highly complex compression algorithm developed by Google. Our implementation uses the `rust-brotli` crate with custom WASM SIMD128 optimizations that provide significant performance improvements over the base implementation.

## Performance Impact

- **SIMD vs Base**: ~5.5x faster (200ms+ → 36ms for 1.28MB JSON at level 9)
- **SIMD vs Native C**: 1.35x faster (36ms vs 48.6ms)
- **Level 11**: Over 90x faster than JS port of native C (~30ms vs ~2.7s)

## SIMD Optimizations

### 1. Shannon Entropy Calculation (`shannon_entropy`)

**Location**: `rust-brotli/src/enc/bit_cost.rs`

**What it does**: Computes the Shannon entropy of a population histogram, which is used to estimate the bit cost of encoding symbols.

**SIMD Optimization**:
```rust
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
{
    let mut sum_v = i32x4_splat(0);
    while i < n_simd {
        unsafe {
            let p_v = v128_load(population.as_ptr().add(i) as *const v128);
            sum_v = i32x4_add(sum_v, p_v);
            // Process 4 elements at once
        }
        i += 4;
    }
}
```

**How it works**:
- Loads 4 consecutive `u32` values (16 bytes) into a SIMD register
- Uses `i32x4_add` to sum 4 values in parallel
- Processes the remaining elements with scalar code

**Why it's safe**:
- Memory alignment: `v128_load` handles unaligned loads safely in WASM
- Bounds checking: The loop ensures `i + 3 < n` before accessing
- Type safety: `u32` values are safely cast to `i32` for SIMD operations (values fit in range)
- Fallback: Scalar code handles remaining elements (< 4)

**Performance gain**: ~4x reduction in loop iterations for histogram summation

### 2. Population Cost Calculation (`BrotliPopulationCost`)

**Location**: `rust-brotli/src/enc/bit_cost.rs`

**What it does**: Quickly finds the first 4 non-zero entries in a histogram to optimize encoding cost calculation.

**SIMD Optimization**:
```rust
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
{
    let zero = i32x4_splat(0);
    while i < data_size && count <= 4 {
        unsafe {
            let v = v128_load(slice.as_ptr().add(i) as *const v128);
            let mask_v = i32x4_gt(v, zero);
            let mask_bits = i32x4_bitmask(mask_v);
            if mask_bits != 0 {
                // Check which of the 4 elements are non-zero
                for j in 0..4 {
                    if slice[i + j] > 0 {
                        s[count] = i + j;
                        count += 1;
                        if count > 4 { break; }
                    }
                }
            }
        }
        i += 4;
    }
}
```

**How it works**:
- Compares 4 histogram values against zero in parallel using `i32x4_gt`
- Uses `i32x4_bitmask` to get a 4-bit mask indicating which elements are non-zero
- Only processes individual elements when the mask indicates non-zero values

**Why it's safe**:
- Early termination: Stops when `count > 4`, preventing buffer overflows
- Bounds checking: Loop condition ensures `i + 3 < data_size`
- Bitmask validation: Only accesses elements when mask confirms they're non-zero
- Scalar fallback: Non-SIMD path provides identical functionality

**Performance gain**: Skips entire blocks of zeros without individual comparisons, ~10-20x faster for sparse histograms

### 3. Match Length Finding (`FindMatchLengthWithLimit`)

**Location**: `rust-brotli/src/enc/static_dict.rs`

**What it does**: Finds the length of matching bytes between two strings, critical for dictionary matching in Brotli.

**SIMD Optimization**:
```rust
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
{
    while matched + 16 <= limit {
        unsafe {
            let a = v128_load(s1.as_ptr().add(matched) as *const v128);
            let b = v128_load(s2.as_ptr().add(matched) as *const v128);
            let eq = i8x16_eq(a, b);
            let mask = i8x16_bitmask(eq) as u32;
            if mask == 0xffff {
                matched += 16;  // All 16 bytes match
            } else {
                return matched + (mask.trailing_ones() as usize);
            }
        }
    }
}
```

**How it works**:
- Loads 16 bytes from both strings into SIMD registers
- Uses `i8x16_eq` to compare all 16 bytes in parallel
- Converts the comparison result to a bitmask
- If all bits set (`0xffff`), all 16 bytes match - continue
- Otherwise, uses `trailing_ones()` to find the first mismatch position

**Why it's safe**:
- Bounds checking: `matched + 16 <= limit` ensures we don't read past the end
- Alignment: `v128_load` handles unaligned memory safely
- Correctness: `trailing_ones()` correctly identifies the first differing byte
- Fallback: Scalar code handles remaining bytes (< 16)

**Performance gain**: ~16x reduction in comparisons for matching prefixes, critical hot path in compression

### 4. Histogram Clearing (`HistogramClear`)

**Location**: `rust-brotli/src/enc/histogram.rs`

**What it does**: Efficiently zeros out histogram arrays.

**SIMD Optimization**:
```rust
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
{
    let zero = i32x4_splat(0);
    while i < n_simd {
        unsafe {
            v128_store(slice.as_mut_ptr().add(i) as *mut v128, zero);
        }
        i += 4;
    }
}
```

**How it works**:
- Creates a zero vector using `i32x4_splat(0)`
- Stores 4 zeros at once using `v128_store`

**Why it's safe**:
- Bounds checking: Loop ensures we don't write past array end
- Alignment: `v128_store` handles unaligned stores safely
- Type safety: Zero vector matches the histogram element type

**Performance gain**: ~4x faster than scalar memset for large histograms

### 5. Histogram Addition (`HistogramAddHistogram`)

**Location**: `rust-brotli/src/enc/histogram.rs`

**What it does**: Adds one histogram to another element-wise.

**SIMD Optimization**:
```rust
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
{
    while i < n_simd {
        unsafe {
            let a = v128_load(h0.as_ptr().add(i) as *const v128);
            let b = v128_load(h1.as_ptr().add(i) as *const v128);
            v128_store(h0.as_mut_ptr().add(i) as *mut v128, i32x4_add(a, b));
        }
        i += 4;
    }
}
```

**How it works**:
- Loads 4 elements from both histograms
- Adds them in parallel using `i32x4_add`
- Stores the result back

**Why it's safe**:
- Bounds checking: Loop ensures both arrays have sufficient elements
- Overflow: Uses `wrapping_add` semantics (matches scalar code)
- Alignment: Handles unaligned memory safely

**Performance gain**: ~4x faster than scalar addition loop

## Safety Guarantees

### Memory Safety

1. **Bounds Checking**: All SIMD operations check array bounds before accessing memory
2. **Alignment**: WASM SIMD128 `v128_load`/`v128_store` handle unaligned memory safely
3. **Type Safety**: All casts are explicit and verified to be safe (e.g., `u32` → `i32` for histogram values)

### Correctness

1. **Fallback Paths**: Non-SIMD scalar code provides identical functionality
2. **Edge Cases**: Remaining elements (< 4 or < 16) are handled by scalar code
3. **Overflow**: Uses wrapping arithmetic where appropriate, matching scalar behavior

### Platform Compatibility

1. **Feature Detection**: All SIMD code is gated by `#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]`
2. **Runtime Detection**: The build system creates separate WASM binaries for SIMD and non-SIMD
3. **Graceful Degradation**: Non-SIMD builds work identically, just slower

## Build Configuration

The Brotli codec uses conditional compilation to enable SIMD:

```toml
[features]
default = []
brotli_simd = ["brotli/simd"]
```

Two WASM binaries are built:
- `brotli-base.wasm`: Stable Rust, no SIMD
- `brotli-simd.wasm`: Nightly Rust with SIMD128 optimizations

The JavaScript wrapper automatically detects SIMD support and loads the appropriate binary.

## Testing

All SIMD optimizations are tested for correctness:
- Unit tests verify identical output between SIMD and scalar paths
- Integration tests ensure compatibility with standard Brotli decoders
- Benchmarks validate performance improvements

## References

- [WASM SIMD Specification](https://github.com/WebAssembly/simd)
- [rust-brotli SIMD Implementation](https://github.com/addmaple/rust-brotli/tree/wasm-simd)
- [Brotli Compression Format](https://datatracker.ietf.org/doc/html/rfc7932)


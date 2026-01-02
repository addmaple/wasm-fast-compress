# SIMD Analysis Report

**Crate:** brotli-wasm  
**Generated:** 2025-12-28T08:44:26.984Z

## Build Variants

| Variant | Description | Features | Size |
|---------|-------------|----------|------|
| scalar | Scalar baseline (no SIMD) | none | 1 MB |
| autovec | LLVM autovectorization (+simd128) | none | 1 MB |

## SIMD Instruction Analysis

| Variant | Total Ops | SIMD Ops | Density | Size |
|---------|-----------|----------|---------|------|
| scalar | 313247 | 0 | 0.0% | 1 MB |
| autovec | 308702 | 4207 | 1.4% | 1 MB |

## SIMD Provenance

| Variant | Scalar | Autovec | Explicit | Compiler Added | Explicit Added |
|---------|--------|---------|----------|----------------|----------------|


## Performance Summary

| Variant | Throughput | Speedup vs Scalar |
|---------|------------|-------------------|
| scalar | 97223.3 MB/s | 1.00x (baseline) |
| autovec | 94813.4 MB/s | 0.98x |

## Speedup by Data Size

Shows how SIMD benefits scale with input size.

| Variant | 1 KB | 16 KB | 64 KB | 256 KB | 1 MB |
|---------|------|------|------|------|------|
| scalar | 1.00x | 1.00x | 1.00x | 1.00x | 1.00x |
| autovec | 1.1x | 1.0x | 0.9x | 1.0x | 1.0x |

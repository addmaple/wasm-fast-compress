# SIMD Analysis Report

**Crate:** gzip-wasm  
**Generated:** 2026-01-02T13:12:54.609Z

## Build Variants

| Variant | Description | Features | Size |
|---------|-------------|----------|------|
| scalar | Scalar baseline (no SIMD) | none | 212 KB |
| autovec | LLVM autovectorization (+simd128) | none | 209 KB |

## SIMD Instruction Analysis

| Variant | Total Ops | SIMD Ops | Density | Size |
|---------|-----------|----------|---------|------|
| scalar | 64534 | 0 | 0.0% | 212 KB |
| autovec | 62571 | 609 | 1.0% | 209 KB |

## SIMD Provenance

| Variant | Scalar | Autovec | Explicit | Compiler Added | Explicit Added |
|---------|--------|---------|----------|----------------|----------------|


## Performance Summary

| Variant | Throughput | Speedup vs Scalar |
|---------|------------|-------------------|
| scalar | 772.7 MB/s | 1.00x (baseline) |
| autovec | 1675.1 MB/s | 2.17x |

## Speedup by Data Size

Shows how SIMD benefits scale with input size.

| Variant | 1 KB | 16 KB | 64 KB | 256 KB | 1 MB |
|---------|------|------|------|------|------|
| scalar | 1.00x | 1.00x | 1.00x | 1.00x | 1.00x |
| autovec | 1.0x | 1.2x | 1.6x | 2.0x | 2.1x |

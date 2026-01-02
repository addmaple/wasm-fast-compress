# SIMD Analysis Report

**Crate:** lz4-wasm  
**Generated:** 2026-01-02T13:30:14.395Z

## Build Variants

| Variant | Description | Features | Size |
|---------|-------------|----------|------|
| scalar | Scalar baseline (no SIMD) | none | 101 KB |
| autovec | LLVM autovectorization (+simd128) | none | 101 KB |

## SIMD Instruction Analysis

| Variant | Total Ops | SIMD Ops | Density | Size |
|---------|-----------|----------|---------|------|
| scalar | 34617 | 0 | 0.0% | 101 KB |
| autovec | 34138 | 293 | 0.9% | 101 KB |

## SIMD Provenance

| Variant | Scalar | Autovec | Explicit | Compiler Added | Explicit Added |
|---------|--------|---------|----------|----------------|----------------|


## Performance Summary

| Variant | Throughput | Speedup vs Scalar |
|---------|------------|-------------------|
| scalar | 10020.8 MB/s | 1.00x (baseline) |
| autovec | 21122.7 MB/s | 2.11x |

## Speedup by Data Size

Shows how SIMD benefits scale with input size.

| Variant | 64 KB | 256 KB | 1 MB |
|---------|------|------|------|
| scalar | 1.00x | 1.00x | 1.00x |
| autovec | 1.9x | 2.0x | 2.1x |

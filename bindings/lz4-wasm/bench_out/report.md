# SIMD Analysis Report

**Crate:** lz4-wasm  
**Generated:** 2026-01-02T15:18:13.723Z

## Build Variants

| Variant | Description | Features | Size |
|---------|-------------|----------|------|
| scalar | Scalar baseline (no SIMD) | none | 101 KB |
| autovec | LLVM autovectorization (+simd128) | none | 100 KB |

## SIMD Instruction Analysis

| Variant | Total Ops | SIMD Ops | Density | Size |
|---------|-----------|----------|---------|------|
| scalar | 34617 | 0 | 0.0% | 101 KB |
| autovec | 34110 | 181 | 0.5% | 100 KB |

## SIMD Provenance

| Variant | Scalar | Autovec | Explicit | Compiler Added | Explicit Added |
|---------|--------|---------|----------|----------------|----------------|


## Performance Summary

| Variant | Throughput | Speedup vs Scalar |
|---------|------------|-------------------|
| scalar | 9981.5 MB/s | 1.00x (baseline) |
| autovec | 20969.7 MB/s | 2.10x |

## Speedup by Data Size

Shows how SIMD benefits scale with input size.

| Variant | 64 KB | 256 KB | 1 MB |
|---------|------|------|------|
| scalar | 1.00x | 1.00x | 1.00x |
| autovec | 1.9x | 2.1x | 2.1x |

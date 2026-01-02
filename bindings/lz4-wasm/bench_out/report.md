# SIMD Analysis Report

**Crate:** lz4-wasm  
**Generated:** 2025-12-28T08:39:30.501Z

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
| scalar | ? MB/s | 1.00x (baseline) |
| autovec | ? MB/s | 1.00x (baseline) |

## Speedup by Data Size

Shows how SIMD benefits scale with input size.

| Variant | 64 KB |
|---------|------|
| scalar | 1.00x |
| autovec | 1.0x |

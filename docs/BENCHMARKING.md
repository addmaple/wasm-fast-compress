# Benchmarking Guide

This document describes the benchmarking setup for `wasm-fast-compress` and references standard compression test corpora.

## Available Benchmarks

### External Library Comparisons

Compare our implementations against popular JavaScript compression libraries using the scripts in the root directory:

- **Gzip**: `node benchmark-silesia.mjs` - compares `@addmaple/gzip` vs `pako`
- **Brotli**: `node benchmark-brotli-minimal.mjs` - compares `@addmaple/brotli` vs `brotli` npm package
- **LZ4**: `node benchmark-silesia.mjs` - compares `@addmaple/lz4` vs `lz4js`

### SIMD vs Non-SIMD Comparisons

Compare SIMD-optimized builds against base builds:

- **Brotli**: `npm run benchmark:simd` in `js/brotli/`
- **LZ4**: `npm run benchmark:simd` in `js/lz4/`

Note: Gzip SIMD builds are currently unavailable due to a dependency issue with `simd-adler32`.

## Test Data

Our benchmarks use a variety of test data sets:

- **small**: ~1.2 KB - Small text data
- **medium**: ~45 KB - Medium text data
- **large**: ~600 KB - Large text data
- **megabyte**: ~1.1 MB - One megabyte of text
- **2mb**: ~2 MB - Two megabytes of text
- **json**: ~339 KB - Structured JSON data
- **binary**: 1 MB - Binary data with repetitive patterns
- **redundant**: ~1 MB - Highly redundant text data

## Standard Compression Test Corpora

For comprehensive compression algorithm evaluation, the following standard corpora are widely used in the compression research community:

### Silesia Corpus
- **Size**: 211 MB total (12 files)
- **Description**: A modern corpus designed to represent data types that are rapidly growing in size
- **Contents**: Large text documents, executables, databases, images, and other diverse data types
- **Use**: Best for evaluating compression on modern, real-world data
- **Download**: Available from [Silesia Corpus](https://sun.aei.pol.pl/~sdeor/index.php?page=silesia)

### Canterbury Corpus
- **Size**: ~2.8 MB total (11 files)
- **Description**: Created to provide representative performance results for compression algorithms
- **Contents**: Mix of text files, binary files, and other data types
- **Use**: Good for quick, representative benchmarks
- **Download**: Available from [Canterbury Corpus](https://corpus.canterbury.ac.nz/)

### Calgary Corpus
- **Size**: ~3.1 MB total (14 files)
- **Description**: One of the earliest compression benchmarks
- **Contents**: Mix of text and binary data
- **Use**: Historical comparisons and baseline testing
- **Note**: Largely replaced by Canterbury corpus but still useful for compatibility testing

### Scientific Data Reduction Benchmarks (SDRBench)
- **Description**: Reference scientific datasets and data reduction techniques
- **Use**: Evaluating compression in scientific computing contexts
- **Website**: [SDRBench](https://sdrbench.github.io/)

## Running Benchmarks

### Quick Start

```bash
# Compare against external libraries
cd js/brotli && npm run benchmark
cd js/lz4 && npm run benchmark
cd js/gzip && npm run benchmark

# Compare SIMD vs non-SIMD
cd js/brotli && npm run benchmark:simd
cd js/lz4 && npm run benchmark:simd
```

### Benchmark Metrics

All benchmarks measure:

- **Compression Speed**: Throughput in MB/s
- **Compression Ratio**: Percentage reduction in size
- **Time Statistics**: Average, min, max, and median times
- **Speedup**: Relative performance comparison (for SIMD benchmarks)

### Interpreting Results

- **Higher throughput (MB/s)** = Faster compression
- **Higher compression ratio (%)** = Better compression (smaller output)
- **Speedup factor** = How many times faster one implementation is vs another

## Performance Considerations

### SIMD Support

SIMD (Single Instruction, Multiple Data) support provides significant performance improvements:

- **Browser Support**: Chrome ≥91, Firefox ≥89, Safari ≥16.4, Edge ≥91
- **Node.js Support**: Node.js ≥16.4
- **Automatic Detection**: Our code automatically detects SIMD support and loads the appropriate WASM module

### Environment Factors

Benchmark results can vary based on:

- CPU architecture (ARM vs x86)
- Node.js version
- System load
- Available memory

For consistent results, run benchmarks on an idle system and average multiple runs.

## Contributing

When adding new benchmarks:

1. Follow the existing benchmark structure
2. Include multiple data sizes (especially 1MB+)
3. Test multiple compression levels
4. Provide clear summary statistics
5. Document any special considerations




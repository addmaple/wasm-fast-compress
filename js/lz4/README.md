# @addmaple/lz4

Fast LZ4 compression in the browser and Node.js using Rust + WASM.

**2.5x-3.5x faster** than `lz4js`.

## Implementation (Rust)

This package is backed by these Rust crates in the `wasm-fast-compress` repo:

- `codec-lz4` (this repo): high-level codec wrapper
- `lz4_flex` (Git fork, branch `wasm-simd`): core LZ4 implementation with WASM SIMD128 hot paths

## SIMD acceleration (how it works)

- We build **two WASM binaries**:
  - `lz4.base.wasm`: compiled without `+simd128`
  - `lz4.simd.wasm`: compiled with `-C target-feature=+simd128`
- At runtime, the JS loader detects SIMD support and loads the best binary automatically.

On wasm32, the SIMD build benefits from:
- `lz4_flex` explicit `wasm32 + simd128` intrinsics for match finding / copying hot paths
- additional LLVM autovectorization where applicable

## Installation

```bash
npm install @addmaple/lz4
```

## Usage

```javascript
import { init, compress } from '@addmaple/lz4';

// Optional: call init() to avoid first-call latency.
// If you skip init(), the first compress/decompress call will lazy-initialize.
await init();

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input);
```

### Lazy init (init() optional)

```javascript
import { compress } from '@addmaple/lz4';

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input); // triggers lazy init on first call
```

### Streaming compression + decompression

For chunked input (e.g. streaming over the network), use the handle-based streaming helpers:

```javascript
import { init, StreamingCompressor, StreamingDecompressor } from '@addmaple/lz4';

// Optional: init() is not required; streaming helpers also lazy-init.
await init();

// Compress
const enc = new StreamingCompressor();
const c1 = await enc.compressChunk(chunk1, false);
const c2 = await enc.compressChunk(chunk2, false);
const c3 = await enc.compressChunk(chunk3, true); // finish

// Decompress (finish must be true to produce output for frame format)
const dec = new StreamingDecompressor();
await dec.decompressChunk(c1, false);
await dec.decompressChunk(c2, false);
const plain = await dec.decompressChunk(c3, true);
```

### Inline (Zero-latency)

WASM bytes embedded directly in JS — no separate file fetching:

```javascript
import { init, compress } from '@addmaple/lz4/inline';

await init();
const compressed = await compress(input);
```

## API

### `init()`
Initialize the WASM module.

### `compress(input)`
- `input`: `Uint8Array`
- Returns: `Promise<Uint8Array>`

Note: LZ4 is a single-speed algorithm optimized for maximum throughput. Unlike Brotli/Gzip, it doesn't have compression levels.

## Sponsor

Development of this module was sponsored by [addmaple.com](https://addmaple.com) — a modern data analysis platform.

## License

MIT


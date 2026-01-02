# @addmaple/gzip

Fast Gzip compression in the browser and Node.js using Rust + WASM.

**3.5x-5.5x faster** than `pako`.

## Implementation (Rust)

This package is backed by these Rust crates in the `wasm-fast-compress` repo:

- `codec-gzip` (this repo): high-level codec wrapper
- `flate2` (crates.io): gzip/deflate API
- `zlib-rs` (via `flate2` feature `zlib-rs`): fast, pure-Rust zlib/deflate backend with WASM SIMD128 intrinsics

## SIMD acceleration (how it works)

- We build **two WASM binaries**:
  - `gzip.base.wasm`: compiled without `+simd128`
  - `gzip.simd.wasm`: compiled with `-C target-feature=+simd128`
- At runtime, the JS loader detects SIMD support and loads the best binary automatically.

`zlib-rs` includes WASM SIMD128 code paths (e.g. match finding / checksums) that activate when `simd128` is enabled in the SIMD build.

## Installation

```bash
npm install @addmaple/gzip
```

## Usage

```javascript
import { init, compress } from '@addmaple/gzip';

// Optional: call init() to avoid first-call latency.
// If you skip init(), the first compress/decompress call will lazy-initialize.
await init();

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input, { level: 9 });
```

### Lazy init (init() optional)

```javascript
import { compress } from '@addmaple/gzip';

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input, { level: 6 }); // triggers lazy init on first call
```

### Streaming compression

For chunked input (e.g. file uploads), use `StreamingCompressor`:

```javascript
import { init, StreamingCompressor } from '@addmaple/gzip';

// Optional: init() is not required; streaming helper also lazy-inits.
await init();

const gz = new StreamingCompressor({ level: 6 });

// First chunk(s)
const out1 = await gz.compressChunk(chunk1, false);
const out2 = await gz.compressChunk(chunk2, false);

// Final chunk (flushes footer + closes)
const out3 = await gz.compressChunk(chunk3, true);
```

### Streaming to `fetch()` (ergonomic)

```javascript
import { createCompressionStream } from '@addmaple/gzip';

const body = file.stream().pipeThrough(createCompressionStream({ level: 6 }));

await fetch('/upload', {
  method: 'POST',
  headers: {
    'Content-Encoding': 'gzip',
  },
  body,
  duplex: 'half',
});
```

### Streaming decompression from `fetch()` (ergonomic)

```javascript
import { createDecompressionStream } from '@addmaple/gzip';

const res = await fetch('/download');
if (!res.body) throw new Error('No response body');

// Note: this implementation buffers and decompresses on flush.
const decompressed = res.body.pipeThrough(createDecompressionStream());

const buf = await new Response(decompressed).arrayBuffer();
```

### Inline (Zero-latency)

WASM bytes embedded directly in JS — no separate file fetching:

```javascript
import { init, compress } from '@addmaple/gzip/inline';

await init();
const compressed = await compress(input);
```

## API

### `init()`
Initialize the WASM module.

### `compress(input, options?)`
- `input`: `Uint8Array`
- `options.level`: 1-9 (default: 6)
- Returns: `Promise<Uint8Array>`

## Sponsor

Development of this module was sponsored by [addmaple.com](https://addmaple.com) — a modern data analysis platform.

## License

MIT


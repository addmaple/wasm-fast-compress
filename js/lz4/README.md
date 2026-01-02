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

await init();

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input);
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


# @addmaple/brotli

Fast Brotli compression in the browser and Node.js using Rust + WASM with SIMD optimizations.

**1.3x faster** than the `brotli` npm package (JS port of native C) at compression level 9.

## Installation

```bash
npm install @addmaple/brotli
```

## Usage

```javascript
import { init, compress } from '@addmaple/brotli';

await init();

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input, { level: 9 });
```

### Inline (Zero-latency)

WASM bytes embedded directly in JS — no separate file fetching:

```javascript
import { init, compress } from '@addmaple/brotli/inline';

await init();
const compressed = await compress(input);
```

## API

### `init()`
Initialize the WASM module. Automatically detects SIMD support.

### `compress(input, options?)`
- `input`: `Uint8Array`
- `options.level`: 1-11 (default: 9)
- Returns: `Promise<Uint8Array>`

## Sponsor

Development of this module was sponsored by [addmaple.com](https://addmaple.com) — a modern data analysis platform.

## License

MIT


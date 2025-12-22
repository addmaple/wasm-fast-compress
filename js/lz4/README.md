# @addmaple/lz4

Fast LZ4 compression in the browser and Node.js using Rust + WASM.

**2.5x-3.5x faster** than `lz4js`.

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


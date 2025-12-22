# @addmaple/gzip

Fast Gzip compression in the browser and Node.js using Rust + WASM.

**3.5x-5.5x faster** than `pako`.

## Installation

```bash
npm install @addmaple/gzip
```

## Usage

```javascript
import { init, compress } from '@addmaple/gzip';

await init();

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input, { level: 9 });
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


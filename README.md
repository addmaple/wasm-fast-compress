# wasm-fast-compress

Fast, SIMD-optimized compression in the browser and Node.js using Rust + WASM.

## Features

- **Fast compression** using Rust with WASM SIMD128 support.
- **Multiple import styles**: Standard (auto-detecting), Inline (zero-latency loading), and CDN.
- **Environment-aware**: Automatically uses `fetch` in browsers and `fs` in Node.js.
- **Tree-shakable**: Separate packages per codec.
- **Low overhead**: Powered by `wasm-bindgen-lite` for minimal JS glue.

## Supported Codecs

| Package | Codec | Comparison |
| :--- | :--- | :--- |
| `@addmaple/gzip` | Gzip/Deflate | **3.5x-5.5x faster** than `pako` |
| `@addmaple/lz4` | LZ4 | **2.5x-3.5x faster** than `lz4js` |
| `@addmaple/brotli` | Brotli | **1.3x faster** than `brotli` (JS port of native C) |

## Installation

```bash
npm install @addmaple/gzip
# or
npm install @addmaple/brotli
# or
npm install @addmaple/lz4
```

## Usage

### 1. Standard Import (Recommended)
Automatically detects environment (Node/Browser) and SIMD support. Loads `.wasm` files as separate artifacts.

```javascript
import { init, compress } from '@addmaple/gzip';

// Initialization is async and required once
await init();

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input, { level: 9 });
```

### 2. Inline Import (Zero-latency)
WASM bytes are embedded directly in the JS bundle. Ideal for environments where fetching separate files is difficult or adds too much latency.

```javascript
import { init, compress } from '@addmaple/gzip/inline';

await init();
const compressed = await compress(input);
```

### 3. CDN Import (Browser)
Use directly in the browser via `jsdelivr`.

```html
<script type="module">
  import { init, compress } from 'https://cdn.jsdelivr.net/npm/@addmaple/gzip/dist/browser.js';
  
  await init();
  const input = new Uint8Array([1, 2, 3, 4]);
  const output = await compress(input);
</script>
```

## API Reference

Each codec package (`@addmaple/gzip`, `@addmaple/brotli`, `@addmaple/lz4`) exports the same basic API:

### `init(imports?)`
Initializes the WASM module. 
- In **Standard** mode, it detects SIMD support and fetches the appropriate `.wasm` binary.
- In **Inline** mode, it initializes the embedded bytes.

### `compress(input, options?)`
Compresses the input data.
- `input`: `Uint8Array | ArrayBuffer | string`.
- `options.level`: Compression level (codec specific, usually 1-9).
- Returns: `Promise<Uint8Array>`.

### Low-level Exports
For advanced use cases, the generated `wasmExports` are available:
```javascript
import { wasmExports } from '@addmaple/gzip';
// Access raw WASM memory and functions
const { memory, alloc_bytes, free_bytes } = wasmExports();
```

## Performance

See [PERFORMANCE_NOTES.md](./docs/PERFORMANCE_NOTES.md) for detailed benchmarks and comparison against pure-JS alternatives.

## Building from source

1. Install `wasm-bindgen-lite` (included in devDependencies).
2. Run the build script:
```bash
npm run build
```

## Sponsor

Development of these modules was sponsored by [addmaple.com](https://addmaple.com) — a modern data analysis platform.

## License

MIT — see [LICENSE](./LICENSE) for details.

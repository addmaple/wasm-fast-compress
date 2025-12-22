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
| `@wfc/gzip` | Gzip/Deflate | **2.5x-3x faster** than `pako` |
| `@wfc/lz4` | LZ4 | **2x-3.5x faster** than `lz4js` |
| `@wfc/brotli` | Brotli | Highly optimized SIMD implementation |

## Installation

```bash
npm install @wfc/gzip
# or
npm install @wfc/brotli
# or
npm install @wfc/lz4
```

## Usage

### 1. Standard Import (Recommended)
Automatically detects environment (Node/Browser) and SIMD support. Loads `.wasm` files as separate artifacts.

```javascript
import { init, compress } from '@wfc/gzip';

// Initialization is async and required once
await init();

const input = new TextEncoder().encode('hello world');
const compressed = await compress(input, { level: 9 });
```

### 2. Inline Import (Zero-latency)
WASM bytes are embedded directly in the JS bundle. Ideal for environments where fetching separate files is difficult or adds too much latency.

```javascript
import { init, compress } from '@wfc/gzip/inline';

await init();
const compressed = await compress(input);
```

### 3. CDN Import (Browser)
Use directly in the browser via `jsdelivr`.

```html
<script type="module">
  import { init, compress } from 'https://cdn.jsdelivr.net/npm/@wfc/gzip/dist/browser.js';
  
  await init();
  const input = new Uint8Array([1, 2, 3, 4]);
  const output = await compress(input);
</script>
```

## API Reference

Each codec package (`@wfc/gzip`, `@wfc/brotli`, `@wfc/lz4`) exports the same basic API:

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
import { wasmExports } from '@wfc/gzip';
// Access raw WASM memory and functions
const { memory, alloc_bytes, free_bytes } = wasmExports();
```

## Performance

See [PERFORMANCE_NOTES.md](./PERFORMANCE_NOTES.md) for detailed benchmarks and comparison against pure-JS alternatives.

## Building from source

1. Install `wasm-bindgen-lite` (included in devDependencies).
2. Run the build script:
```bash
npm run build
```

## License

MIT

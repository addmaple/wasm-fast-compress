# examples

This directory contains examples of using `wasm-fast-compress` in different environments.

## Node.js

Requires Node.js 20+.

### 1. Basic (Separate WASM)
Uses the standard loader which reads `.wasm` files from the filesystem.
```bash
node node/basic.mjs
```

### 2. Inline (Embedded WASM)
Uses the inline loader where WASM is embedded directly in the JS. Ideal for zero-latency or restricted environments.
```bash
node node/inline.mjs
```

## Browser

### 1. Simple HTML/JS
To run the browser example, you need a local web server (due to WASM fetch restrictions).

Using `npx serve`:
```bash
npx serve .
# Then open browser at http://localhost:3000/examples/browser/
```

The browser example automatically:
1. Detects SIMD support.
2. Fetches the correct `.wasm` binary (SIMD or Base).
3. Provides a simple UI to test compression.

## CDN Usage

You can also use the library directly from a CDN like `jsdelivr`:

```html
<script type="module">
  import { init, compress } from 'https://cdn.jsdelivr.net/npm/@addmaple/gzip/dist/browser.js';
  
  await init();
  const input = new Uint8Array([1, 2, 3, 4]);
  const output = await compress(input);
</script>
```


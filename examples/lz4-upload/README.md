# LZ4 Upload Demo

This example demonstrates using `@addmaple/lz4` for blazing-fast client-server compression.

## Features

- **Client-side compression**: Compress data in the browser before sending
- **Packed format**: Size is embedded, no need to send separately
- **Server-side decompression**: Express server decompresses at 600+ MB/s
- **~5x bandwidth savings**: JSON compresses to ~21% of original size

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3456
```

## Performance

| Records | Original | Compressed | Ratio | Client Compress | Server Decompress |
|---------|----------|------------|-------|-----------------|-------------------|
| 10K | 1.44 MB | 310 KB | 21% | 6ms | 333 MB/s |
| 100K | 14.56 MB | 3.05 MB | 21% | 26ms | 634 MB/s |

## API Usage

### Client (Browser)

```javascript
import { init, compressPacked } from '@addmaple/lz4';

await init();

// Compress JSON before sending
const data = { records: [...] };
const json = JSON.stringify(data);
const bytes = new TextEncoder().encode(json);
const compressed = await compressPacked(bytes);

// Send compressed data
await fetch('/api/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: compressed
});
```

### Server (Node.js)

```javascript
import { init, decompressPacked } from '@addmaple/lz4';

await init();

app.post('/api/upload', express.raw({ type: 'application/octet-stream' }), async (req, res) => {
  const compressed = new Uint8Array(req.body);
  const decompressed = await decompressPacked(compressed);
  const json = JSON.parse(new TextDecoder().decode(decompressed));
  // Use json...
});
```

## Why LZ4 Block?

| Format | Speed | Use Case |
|--------|-------|----------|
| **LZ4 Block** | 14 GB/s | Max speed, you control both ends |
| LZ4 Frame | 10 GB/s | Compatible with `lz4` CLI |
| Gzip | 99 MB/s | Standard HTTP compression |

LZ4 Block is **140x faster** than Gzip for the same compression ratio on JSON data.


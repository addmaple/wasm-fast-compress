import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

// Import our libs
import { init as initGzip, compress as compressGzip } from '../js/gzip/dist/node.js';
import { init as initBrotli, compress as compressBrotli } from '../js/brotli/dist/node.js';
import { init as initLz4, compress as compressLz4 } from '../js/lz4/dist/node.js';

// Import decompression libs
import pako from 'pako';
import { decompress as brotliDecompress } from 'brotli';
import { decompress as lz4jsDecompress } from 'lz4js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DATA = join(__dirname, '../test-data/silesia/large.json');

async function testInterop() {
  console.log('--- Interop Tests ---');
  
  // 1. Load test data
  let data;
  try {
    data = await readFile(TEST_DATA);
  } catch (e) {
    console.warn(`Could not find ${TEST_DATA}, using fallback string.`);
    data = new TextEncoder().encode('Fallback interop test data string. ' + 'A'.repeat(1000));
  }
  
  console.log(`Test data size: ${data.length} bytes`);

  // Initialize all our libs
  await Promise.all([
    initGzip(),
    initBrotli(),
    initLz4()
  ]);

  // 2. Gzip Interop
  console.log('\nTesting Gzip interop...');
  const gzipCompressed = await compressGzip(data, { level: 9 });
  const gzipDecompressed = pako.ungzip(gzipCompressed);
  assert.deepStrictEqual(Buffer.from(gzipDecompressed), Buffer.from(data), 'Gzip decompression failed');
  console.log('✅ Gzip: @addmaple -> pako SUCCESS');

  // 3. Brotli Interop
  console.log('\nTesting Brotli interop...');
  const brotliCompressed = await compressBrotli(data, { level: 9 });
  const brotliDecompressed = brotliDecompress(Buffer.from(brotliCompressed));
  assert.deepStrictEqual(Buffer.from(brotliDecompressed), Buffer.from(data), 'Brotli decompression failed');
  console.log('✅ Brotli: @addmaple -> brotli-npm SUCCESS');

  // 4. LZ4 Interop
  console.log('\nTesting LZ4 interop...');
  const lz4Compressed = await compressLz4(data, { level: 9 });
  // lz4js decompress expects Uint8Array
  const lz4Decompressed = lz4jsDecompress(lz4Compressed);
  assert.deepStrictEqual(Buffer.from(lz4Decompressed), Buffer.from(data), 'LZ4 decompression failed');
  console.log('✅ LZ4: @addmaple -> lz4js SUCCESS');

  console.log('\n--- All Interop Tests Passed ---');
}

testInterop().catch(err => {
  console.error('\n❌ Interop Test Failed:');
  console.error(err);
  process.exit(1);
});


/**
 * Node.js Example - Inline Gzip Compression (Zero Latency)
 * 
 * To run this example locally:
 * node inline.mjs
 */

import { init, compress } from '../../js/gzip/dist/node-inline.js';

async function run() {
  console.log('Initializing Inline WASM (no file fetching required)...');
  await init();

  const text = 'This is an inline example. '.repeat(50);
  const input = new TextEncoder().encode(text);
  
  console.log(`Input size: ${input.length} bytes`);

  const compressed = await compress(input);
  console.log(`Compressed size: ${compressed.length} bytes`);
  console.log('Success!');
}

run().catch(console.error);

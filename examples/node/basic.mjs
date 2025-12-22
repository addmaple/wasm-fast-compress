/**
 * Node.js Example - Basic Gzip Compression
 * 
 * To run this example locally:
 * node basic.mjs
 */

import { init, compress } from '../../js/gzip/dist/node.js';
import { readFile } from 'node:fs/promises';

async function run() {
  console.log('Initializing WASM...');
  await init();

  const text = JSON.stringify([
    {
      "id": "5f9d88b2-6d1d-4b8b-8b1d-8b8b8b8b8b8b",
      "index": 0,
      "guid": "c1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "isActive": true,
      "balance": "$3,456.78",
      "picture": "http://placehold.it/32x32",
      "age": 28,
      "eyeColor": "blue",
      "name": "John Doe",
      "gender": "male",
      "company": "TECHCORP",
      "email": "john.doe@techcorp.com",
      "phone": "+1 (800) 555-1212",
      "address": "123 Main St, Anytown, USA",
      "about": "Deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      "registered": "2023-01-01T12:00:00 -08:00",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "tags": ["tech", "rust", "wasm", "compression"],
      "friends": [
        { "id": 0, "name": "Jane Smith" },
        { "id": 1, "name": "Bob Johnson" }
      ]
    },
    {
      "id": "6a7b8c9d-0e1f-2a3b-4c5d-5f9d88b26d1d",
      "index": 1,
      "guid": "d4c3b2a1-f6e5-4b5a-d9c8-d5c4b3a2f1e0",
      "isActive": false,
      "balance": "$1,234.56",
      "picture": "http://placehold.it/32x32",
      "age": 32,
      "eyeColor": "green",
      "name": "Jane Smith",
      "gender": "female",
      "company": "SOFTCO",
      "email": "jane.smith@softco.com",
      "phone": "+1 (800) 555-1234",
      "address": "456 Side St, Othertown, USA",
      "about": "Nulla pariatur. Excepteur sint occaecat cupidatat non proident.",
      "registered": "2022-06-15T09:30:00 -07:00",
      "latitude": 34.0522,
      "longitude": -118.2437,
      "tags": ["soft", "js", "web", "performance"],
      "friends": [
        { "id": 0, "name": "John Doe" },
        { "id": 1, "name": "Alice Brown" }
      ]
    }
  ], null, 2);
  const input = new TextEncoder().encode(text);
  
  console.log(`Input size: ${input.length} bytes`);

  const start = performance.now();
  const compressed = await compress(input, { level: 9 });
  const end = performance.now();

  console.log(`Compressed size: ${compressed.length} bytes`);
  console.log(`Compression ratio: ${((1 - compressed.length / input.length) * 100).toFixed(2)}%`);
  console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
}

run().catch(console.error);

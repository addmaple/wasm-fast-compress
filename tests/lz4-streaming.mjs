/**
 * Node.js Test - LZ4 Streaming Compression and Decompression
 * 
 * This test demonstrates streaming compression and decompression using LZ4.
 * 
 * To run this test:
 * node tests/lz4-streaming.mjs
 */

import { init, StreamingCompressor, StreamingDecompressor, decompress } from '../js/lz4/dist/node.js';
import assert from 'node:assert';

async function testStreamingCompression() {
  console.log('--- LZ4 Streaming Compression Test ---');
  
  await init();
  
  // Test data - split into chunks to simulate streaming
  const chunks = [
    new TextEncoder().encode('Hello, '),
    new TextEncoder().encode('this is a '),
    new TextEncoder().encode('streaming '),
    new TextEncoder().encode('compression test!'),
  ];
  
  const originalData = new Uint8Array(
    chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    originalData.set(chunk, offset);
    offset += chunk.length;
  }
  
  console.log(`Original data size: ${originalData.length} bytes`);
  
  // Test streaming compression
  console.log('\nTesting streaming compression...');
  const compressor = new StreamingCompressor();
  
  const compressedChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const compressed = await compressor.compressChunk(chunks[i], isLast);
    if (compressed && compressed.length > 0) {
      compressedChunks.push(compressed);
      console.log(`  Chunk ${i + 1}: ${chunks[i].length} bytes -> ${compressed.length} bytes`);
    } else if (!isLast) {
      console.log(`  Chunk ${i + 1}: ${chunks[i].length} bytes -> (buffered, no output yet)`);
    }
  }
  
  // Combine compressed chunks
  const totalCompressedSize = compressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const compressed = new Uint8Array(totalCompressedSize);
  offset = 0;
  for (const chunk of compressedChunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }
  
  console.log(`Compressed size: ${compressed.length} bytes`);
  console.log(`Compression ratio: ${((1 - compressed.length / originalData.length) * 100).toFixed(2)}%`);
  
  await compressor.destroy();
  
  // Test one-shot decompression
  console.log('\nTesting one-shot decompression...');
  const decompressed = await decompress(compressed);
  console.log(`Decompressed size: ${decompressed.length} bytes`);
  
  assert.deepStrictEqual(
    Buffer.from(decompressed),
    Buffer.from(originalData),
    'Decompressed data does not match original'
  );
  console.log('✅ One-shot decompression: SUCCESS');
  
  // Test streaming decompression
  console.log('\nTesting streaming decompression...');
  const decompressor = new StreamingDecompressor();
  
  // Split compressed data into chunks for streaming decompression
  const compressedChunkSize = Math.ceil(compressed.length / 3);
  const compressedChunksForDecomp = [];
  for (let i = 0; i < compressed.length; i += compressedChunkSize) {
    compressedChunksForDecomp.push(compressed.slice(i, i + compressedChunkSize));
  }
  
  const decompressedChunks = [];
  for (let i = 0; i < compressedChunksForDecomp.length; i++) {
    const isLast = i === compressedChunksForDecomp.length - 1;
    const decompressed = await decompressor.decompressChunk(compressedChunksForDecomp[i], isLast);
    if (decompressed && decompressed.length > 0) {
      decompressedChunks.push(decompressed);
      console.log(`  Chunk ${i + 1}: ${compressedChunksForDecomp[i].length} bytes -> ${decompressed.length} bytes`);
    } else if (!isLast) {
      console.log(`  Chunk ${i + 1}: ${compressedChunksForDecomp[i].length} bytes -> (buffered, no output yet)`);
    }
  }
  
  // Combine decompressed chunks
  const totalDecompressedSize = decompressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const streamingDecompressed = new Uint8Array(totalDecompressedSize);
  offset = 0;
  for (const chunk of decompressedChunks) {
    streamingDecompressed.set(chunk, offset);
    offset += chunk.length;
  }
  
  console.log(`Streaming decompressed size: ${streamingDecompressed.length} bytes`);
  
  assert.deepStrictEqual(
    Buffer.from(streamingDecompressed),
    Buffer.from(originalData),
    'Streaming decompressed data does not match original'
  );
  console.log('✅ Streaming decompression: SUCCESS');
  
  await decompressor.destroy();
  
  console.log('\n--- All Streaming Tests Passed ---');
}

testStreamingCompression().catch(err => {
  console.error('\n❌ Streaming Test Failed:');
  console.error(err);
  process.exit(1);
});


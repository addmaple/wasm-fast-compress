/**
 * Compression Upload Demo - Express Server
 * 
 * Demonstrates all three codecs: LZ4, Gzip, and Brotli
 * Client compresses data before sending, server decompresses on receive.
 * 
 * Run: npm install && npm start
 * Open: http://localhost:3456
 */

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

// Import all codecs
import { init as initLz4, compress as compressLz4, decompress as decompressLz4, compressPacked, decompressPacked } from '@addmaple/lz4';
import { init as initGzip, compress as compressGzip, decompress as decompressGzip } from '@addmaple/gzip';
import { init as initBrotli, compress as compressBrotli, decompress as decompressBrotli } from '@addmaple/brotli';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3456;

// Initialize all WASM modules
await Promise.all([initLz4(), initGzip(), initBrotli()]);
console.log('✅ All WASM modules initialized (LZ4, Gzip, Brotli)');

// Codec registry
const codecs = {
  lz4: { 
    compress: compressLz4, 
    decompress: decompressLz4,
    compressPacked,
    decompressPacked
  },
  gzip: { 
    compress: (data, opts) => compressGzip(data, opts),
    decompress: decompressGzip
  },
  brotli: { 
    compress: (data, opts) => compressBrotli(data, opts),
    decompress: decompressBrotli
  }
};

// Serve static files (client HTML/JS)
app.use(express.static(__dirname));

// Serve codec browser bundles
app.use('/lz4', express.static(path.join(__dirname, '../../js/lz4/dist')));
app.use('/gzip', express.static(path.join(__dirname, '../../js/gzip/dist')));
app.use('/brotli', express.static(path.join(__dirname, '../../js/brotli/dist')));

// Generic upload endpoint - codec specified in URL
// Format: /api/upload/:codec
// Body: [4-byte size prefix] + [compressed data] (for all codecs)
app.post('/api/upload/:codec', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  const startTime = performance.now();
  const codecName = req.params.codec.toLowerCase();
  
  if (!codecs[codecName]) {
    return res.status(400).json({ error: `Unknown codec: ${codecName}. Use lz4, gzip, or brotli.` });
  }
  
  try {
    const compressedData = new Uint8Array(req.body);
    const compressedSize = compressedData.length;
    
    // Read size prefix (4 bytes, little-endian)
    const dataView = new DataView(compressedData.buffer, compressedData.byteOffset, compressedData.byteLength);
    const originalSize = dataView.getUint32(0, true);
    const compressedPayload = compressedData.subarray(4);
    
    // Decompress
    const decompressed = await codecs[codecName].decompress(compressedPayload);
    
    const decompressTime = performance.now() - startTime;
    const ratio = ((compressedPayload.length / decompressed.length) * 100).toFixed(1);
    const speed = (decompressed.length / 1024 / 1024) / (decompressTime / 1000);
    
    // Parse the JSON data
    const text = new TextDecoder().decode(decompressed);
    const data = JSON.parse(text);
    
    console.log(`📥 [${codecName.toUpperCase()}] ${(compressedPayload.length/1024).toFixed(1)} KB → ${(decompressed.length/1024).toFixed(1)} KB (${ratio}%)`);
    console.log(`   Decompression: ${decompressTime.toFixed(2)}ms (${speed.toFixed(0)} MB/s)`);
    
    res.json({
      success: true,
      codec: codecName,
      stats: {
        compressedSize: compressedPayload.length,
        originalSize: decompressed.length,
        ratio: parseFloat(ratio),
        decompressTimeMs: parseFloat(decompressTime.toFixed(2)),
        speedMBps: parseFloat(speed.toFixed(0)),
        recordCount: data.records?.length || 0
      }
    });
  } catch (error) {
    console.error(`❌ [${codecName.toUpperCase()}] Decompression failed:`, error.message);
    res.status(400).json({ error: error.message });
  }
});

// LZ4 packed format (backwards compatible)
app.post('/api/upload', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  const startTime = performance.now();
  
  try {
    const compressedData = new Uint8Array(req.body);
    const compressedSize = compressedData.length;
    
    const decompressed = await decompressPacked(compressedData);
    const originalSize = decompressed.length;
    
    const decompressTime = performance.now() - startTime;
    const ratio = ((compressedSize / originalSize) * 100).toFixed(1);
    const speed = (originalSize / 1024 / 1024) / (decompressTime / 1000);
    
    const text = new TextDecoder().decode(decompressed);
    const data = JSON.parse(text);
    
    console.log(`📥 [LZ4] ${(compressedSize/1024).toFixed(1)} KB → ${(originalSize/1024).toFixed(1)} KB (${ratio}%)`);
    console.log(`   Decompression: ${decompressTime.toFixed(2)}ms (${speed.toFixed(0)} MB/s)`);
    
    res.json({
      success: true,
      codec: 'lz4',
      stats: {
        compressedSize,
        originalSize,
        ratio: parseFloat(ratio),
        decompressTimeMs: parseFloat(decompressTime.toFixed(2)),
        speedMBps: parseFloat(speed.toFixed(0)),
        recordCount: data.records?.length || 0
      }
    });
  } catch (error) {
    console.error('❌ Decompression failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Verify endpoint - tests round-trip correctness
app.post('/api/verify/:codec', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  const codecName = req.params.codec.toLowerCase();
  
  if (!codecs[codecName]) {
    return res.status(400).json({ error: `Unknown codec: ${codecName}` });
  }
  
  try {
    const compressedData = new Uint8Array(req.body);
    
    // Read size prefix
    const dataView = new DataView(compressedData.buffer, compressedData.byteOffset, compressedData.byteLength);
    const originalSize = dataView.getUint32(0, true);
    const compressedPayload = compressedData.subarray(4);
    
    // Decompress
    const decompressed = await codecs[codecName].decompress(compressedPayload);
    
    // Re-compress and decompress again
    const recompressed = await codecs[codecName].compress(decompressed);
    const decompressed2 = await codecs[codecName].decompress(recompressed);
    
    // Verify byte-for-byte equality
    const isEqual = decompressed.length === decompressed2.length && 
      decompressed.every((byte, i) => byte === decompressed2[i]);
    
    const hash = (data) => {
      let h = 0;
      for (let i = 0; i < data.length; i++) {
        h = ((h << 5) - h + data[i]) | 0;
      }
      return h >>> 0;
    };
    
    const originalHash = hash(decompressed);
    const roundTripHash = hash(decompressed2);
    
    console.log(`🔍 [${codecName.toUpperCase()}] Verify: ${decompressed.length} bytes, equal=${isEqual}`);
    
    res.json({
      success: true,
      codec: codecName,
      verified: isEqual,
      originalSize: decompressed.length,
      roundTripSize: decompressed2.length,
      originalHash,
      roundTripHash,
      hashMatch: originalHash === roundTripHash
    });
  } catch (error) {
    console.error(`❌ [${codecName.toUpperCase()}] Verify failed:`, error.message);
    res.status(400).json({ error: error.message, verified: false });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Compression Demo running at http://localhost:${PORT}`);
  console.log(`   Supported codecs: LZ4, Gzip, Brotli\n`);
});

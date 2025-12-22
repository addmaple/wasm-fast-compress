// Full comparison benchmark: SIMD vs Base vs JS
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pako from 'pako';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadWasm(wasmPath) {
    const wasmBuffer = readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {});
    return instance;
}

function wasmCompress(instance, data, abi) {
    const exports = instance.exports;
    const inLen = data.length;
    const outLen = inLen + 1024;
    
    const inPtr = exports.alloc_bytes(inLen);
    const outPtr = exports.alloc_bytes(outLen);
    
    let memory = new Uint8Array(exports.memory.buffer);
    memory.set(data, inPtr);
    
    const written = exports[abi](inPtr, inLen, outPtr, outLen);
    
    if (written < 0) {
        exports.free_bytes(inPtr, inLen);
        exports.free_bytes(outPtr, outLen);
        throw new Error(`Compression failed: ${written}`);
    }
    
    memory = new Uint8Array(exports.memory.buffer);
    const result = memory.slice(outPtr, outPtr + written);
    exports.free_bytes(inPtr, inLen);
    exports.free_bytes(outPtr, outLen);
    
    return result;
}

function benchmark(fn, runs = 10) {
    // Warmup
    for (let i = 0; i < 3; i++) fn();
    
    const times = [];
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        fn();
        times.push(performance.now() - start);
    }
    
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
}

function generateData(size) {
    const items = [];
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    const cities = ['New York', 'London', 'Tokyo', 'Paris', 'Sydney'];
    
    while (JSON.stringify(items).length < size) {
        items.push({
            id: Math.floor(Math.random() * 1000000),
            name: names[Math.floor(Math.random() * names.length)],
            email: `user${items.length}@example.com`,
            city: cities[Math.floor(Math.random() * cities.length)],
            score: Math.random() * 100,
        });
    }
    
    const jsonStr = JSON.stringify(items);
    return new TextEncoder().encode(jsonStr.slice(0, size));
}

function formatSpeed(sizeMB, timeMs) {
    if (timeMs === 0) return 'N/A';
    const speed = sizeMB / (timeMs / 1000);
    if (speed >= 1000) return (speed / 1000).toFixed(1) + ' GB/s';
    return speed.toFixed(0) + ' MB/s';
}

function formatSpeedup(base, current) {
    const speedup = base / current;
    if (speedup > 1.1) return `${speedup.toFixed(2)}x 🚀`;
    if (speedup < 0.9) return `${speedup.toFixed(2)}x`;
    return `${speedup.toFixed(2)}x`;
}

async function main() {
    const size = 1024 * 1024; // 1 MB
    const data = generateData(size);
    const sizeMB = size / 1024 / 1024;
    
    console.log('\n' + '='.repeat(80));
    console.log('  🔬 CODEC COMPARISON: SIMD vs Base vs JS (1 MB JSON)');
    console.log('='.repeat(80));
    
    // Load all WASM modules
    const gzipBase = await loadWasm(path.join(__dirname, '../js/gzip/dist/wasm/gzip.base.wasm'));
    const gzipSimd = await loadWasm(path.join(__dirname, '../js/gzip/dist/wasm/gzip.simd.wasm'));
    const brotliBase = await loadWasm(path.join(__dirname, '../js/brotli/dist/wasm/brotli.base.wasm'));
    const brotliSimd = await loadWasm(path.join(__dirname, '../js/brotli/dist/wasm/brotli.simd.wasm'));
    const lz4Base = await loadWasm(path.join(__dirname, '../js/lz4/dist/wasm/lz4.base.wasm'));
    const lz4Simd = await loadWasm(path.join(__dirname, '../js/lz4/dist/wasm/lz4.simd.wasm'));
    
    // ============ GZIP ============
    console.log('\n' + '─'.repeat(80));
    console.log('  GZIP (Level 6)');
    console.log('─'.repeat(80));
    
    const gzipJsTime = benchmark(() => pako.gzip(data, { level: 6 }));
    const gzipJsResult = pako.gzip(data, { level: 6 });
    
    const gzipBaseTime = benchmark(() => wasmCompress(gzipBase, data, 'compress_gzip_level_6'));
    const gzipBaseResult = wasmCompress(gzipBase, data, 'compress_gzip_level_6');
    
    const gzipSimdTime = benchmark(() => wasmCompress(gzipSimd, data, 'compress_gzip_level_6'));
    const gzipSimdResult = wasmCompress(gzipSimd, data, 'compress_gzip_level_6');
    
    console.log('| Implementation     | Time (ms) | Speed        | vs JS     | Ratio  |');
    console.log('|--------------------|-----------|--------------|-----------|--------|');
    console.log(`| pako (JS)          | ${gzipJsTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, gzipJsTime).padStart(12)} | baseline  | ${(gzipJsResult.length/data.length*100).toFixed(1)}%   |`);
    console.log(`| @addmaple (Base)   | ${gzipBaseTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, gzipBaseTime).padStart(12)} | ${formatSpeedup(gzipJsTime, gzipBaseTime).padStart(9)} | ${(gzipBaseResult.length/data.length*100).toFixed(1)}%   |`);
    console.log(`| @addmaple (SIMD)   | ${gzipSimdTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, gzipSimdTime).padStart(12)} | ${formatSpeedup(gzipJsTime, gzipSimdTime).padStart(9)} | ${(gzipSimdResult.length/data.length*100).toFixed(1)}%   |`);
    
    // ============ BROTLI ============
    console.log('\n' + '─'.repeat(80));
    console.log('  BROTLI (Level 6)');
    console.log('─'.repeat(80));
    
    const brotliBaseTime = benchmark(() => wasmCompress(brotliBase, data, 'compress_brotli_level_6'));
    const brotliBaseResult = wasmCompress(brotliBase, data, 'compress_brotli_level_6');
    
    const brotliSimdTime = benchmark(() => wasmCompress(brotliSimd, data, 'compress_brotli_level_6'));
    const brotliSimdResult = wasmCompress(brotliSimd, data, 'compress_brotli_level_6');
    
    console.log('| Implementation     | Time (ms) | Speed        | vs Base   | Ratio  |');
    console.log('|--------------------|-----------|--------------|-----------|--------|');
    console.log(`| brotli (JS)*       |       N/A | N/A          | N/A       | N/A    |`);
    console.log(`| @addmaple (Base)   | ${brotliBaseTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, brotliBaseTime).padStart(12)} | baseline  | ${(brotliBaseResult.length/data.length*100).toFixed(1)}%   |`);
    console.log(`| @addmaple (SIMD)   | ${brotliSimdTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, brotliSimdTime).padStart(12)} | ${formatSpeedup(brotliBaseTime, brotliSimdTime).padStart(9)} | ${(brotliSimdResult.length/data.length*100).toFixed(1)}%   |`);
    console.log('* brotli npm package only has decoder for browser');
    
    // ============ LZ4 ============
    console.log('\n' + '─'.repeat(80));
    console.log('  LZ4');
    console.log('─'.repeat(80));
    
    // Frame API
    const lz4FrameBaseTime = benchmark(() => wasmCompress(lz4Base, data, 'compress_lz4'));
    const lz4FrameBaseResult = wasmCompress(lz4Base, data, 'compress_lz4');
    
    const lz4FrameSimdTime = benchmark(() => wasmCompress(lz4Simd, data, 'compress_lz4'));
    const lz4FrameSimdResult = wasmCompress(lz4Simd, data, 'compress_lz4');
    
    // Block API
    const lz4BlockBaseTime = benchmark(() => wasmCompress(lz4Base, data, 'compress_lz4_block'));
    const lz4BlockBaseResult = wasmCompress(lz4Base, data, 'compress_lz4_block');
    
    const lz4BlockSimdTime = benchmark(() => wasmCompress(lz4Simd, data, 'compress_lz4_block'));
    const lz4BlockSimdResult = wasmCompress(lz4Simd, data, 'compress_lz4_block');
    
    console.log('\nLZ4 Frame (compatible with lz4 CLI, includes checksums):');
    console.log('| Implementation     | Time (ms) | Speed        | vs Base   | Ratio  |');
    console.log('|--------------------|-----------|--------------|-----------|--------|');
    console.log(`| @addmaple (Base)   | ${lz4FrameBaseTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, lz4FrameBaseTime).padStart(12)} | baseline  | ${(lz4FrameBaseResult.length/data.length*100).toFixed(1)}%   |`);
    console.log(`| @addmaple (SIMD)   | ${lz4FrameSimdTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, lz4FrameSimdTime).padStart(12)} | ${formatSpeedup(lz4FrameBaseTime, lz4FrameSimdTime).padStart(9)} | ${(lz4FrameSimdResult.length/data.length*100).toFixed(1)}%   |`);
    
    console.log('\nLZ4 Block (raw format, maximum speed):');
    console.log('| Implementation     | Time (ms) | Speed        | vs Base   | Ratio  |');
    console.log('|--------------------|-----------|--------------|-----------|--------|');
    console.log(`| @addmaple (Base)   | ${lz4BlockBaseTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, lz4BlockBaseTime).padStart(12)} | baseline  | ${(lz4BlockBaseResult.length/data.length*100).toFixed(1)}%   |`);
    console.log(`| @addmaple (SIMD)   | ${lz4BlockSimdTime.toFixed(2).padStart(9)} | ${formatSpeed(sizeMB, lz4BlockSimdTime).padStart(12)} | ${formatSpeedup(lz4BlockBaseTime, lz4BlockSimdTime).padStart(9)} | ${(lz4BlockSimdResult.length/data.length*100).toFixed(1)}%   |`);
    
    // ============ SUMMARY ============
    console.log('\n' + '='.repeat(80));
    console.log('  SUMMARY: SIMD SPEEDUPS');
    console.log('='.repeat(80));
    
    console.log('| Codec              | Base Speed   | SIMD Speed   | SIMD Speedup |');
    console.log('|--------------------|--------------|--------------|--------------|');
    console.log(`| Gzip L6            | ${formatSpeed(sizeMB, gzipBaseTime).padStart(12)} | ${formatSpeed(sizeMB, gzipSimdTime).padStart(12)} | ${formatSpeedup(gzipBaseTime, gzipSimdTime).padStart(12)} |`);
    console.log(`| Brotli L6          | ${formatSpeed(sizeMB, brotliBaseTime).padStart(12)} | ${formatSpeed(sizeMB, brotliSimdTime).padStart(12)} | ${formatSpeedup(brotliBaseTime, brotliSimdTime).padStart(12)} |`);
    console.log(`| LZ4 Frame          | ${formatSpeed(sizeMB, lz4FrameBaseTime).padStart(12)} | ${formatSpeed(sizeMB, lz4FrameSimdTime).padStart(12)} | ${formatSpeedup(lz4FrameBaseTime, lz4FrameSimdTime).padStart(12)} |`);
    console.log(`| LZ4 Block          | ${formatSpeed(sizeMB, lz4BlockBaseTime).padStart(12)} | ${formatSpeed(sizeMB, lz4BlockSimdTime).padStart(12)} | ${formatSpeedup(lz4BlockBaseTime, lz4BlockSimdTime).padStart(12)} |`);
    
    console.log('\n' + '='.repeat(80));
    console.log('  vs JAVASCRIPT LIBRARIES');
    console.log('='.repeat(80));
    
    console.log('| Codec              | JS Speed     | SIMD Speed   | Speedup vs JS |');
    console.log('|--------------------|--------------|--------------|---------------|');
    console.log(`| Gzip L6 vs pako    | ${formatSpeed(sizeMB, gzipJsTime).padStart(12)} | ${formatSpeed(sizeMB, gzipSimdTime).padStart(12)} | ${formatSpeedup(gzipJsTime, gzipSimdTime).padStart(13)} |`);
    
    console.log('\n✅ Complete!\n');
}

main().catch(console.error);


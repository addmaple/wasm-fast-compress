// LZ4-only benchmark - avoid JIT interference from other codecs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadWasm(wasmPath) {
    const wasmBuffer = readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {});
    return instance;
}

function compress(instance, data, abi) {
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

function benchmark(instance, data, abi, runs = 10) {
    // Extended warmup
    for (let i = 0; i < 5; i++) {
        compress(instance, data, abi);
    }
    
    const times = [];
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        compress(instance, data, abi);
        times.push(performance.now() - start);
    }
    
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
}

function generateTestData(size) {
    // Highly compressible JSON pattern
    const pattern = '{"id":12345,"name":"test_user","email":"user@example.com","values":[1,2,3,4,5],"nested":{"a":1,"b":2}}';
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        data[i] = pattern.charCodeAt(i % pattern.length);
    }
    return data;
}

async function main() {
    console.log(`\n🔬 LZ4 SIMD vs Base Benchmark (dedicated)\n`);
    
    const baseInstance = await loadWasm(path.join(__dirname, '../js/lz4/dist/wasm/lz4.base.wasm'));
    const simdInstance = await loadWasm(path.join(__dirname, '../js/lz4/dist/wasm/lz4.simd.wasm'));
    
    const sizes = [
        { name: '100 KB', size: 100 * 1024 },
        { name: '1 MB', size: 1024 * 1024 },
    ];
    
    console.log('=== LZ4 Block API (no frame overhead) ===');
    console.log('| Size | Base (ms) | SIMD (ms) | Base Speed | SIMD Speed | Speedup |');
    console.log('|------|-----------|-----------|------------|------------|---------|');
    
    for (const { name, size } of sizes) {
        const data = generateTestData(size);
        const sizeMB = size / 1024 / 1024;
        
        const baseTime = benchmark(baseInstance, data, 'compress_lz4_block');
        const simdTime = benchmark(simdInstance, data, 'compress_lz4_block');
        const speedup = baseTime / simdTime;
        
        const baseSpeed = (sizeMB / (baseTime / 1000)).toFixed(1);
        const simdSpeed = (sizeMB / (simdTime / 1000)).toFixed(1);
        
        console.log(`| ${name} | ${baseTime.toFixed(2)} | ${simdTime.toFixed(2)} | ${baseSpeed} MB/s | ${simdSpeed} MB/s | ${speedup.toFixed(2)}x |`);
    }
    
    console.log('');
    console.log('=== LZ4 Frame API (with checksums) ===');
    console.log('| Size | Base (ms) | SIMD (ms) | Base Speed | SIMD Speed | Speedup |');
    console.log('|------|-----------|-----------|------------|------------|---------|');
    
    for (const { name, size } of sizes) {
        const data = generateTestData(size);
        const sizeMB = size / 1024 / 1024;
        
        const baseTime = benchmark(baseInstance, data, 'compress_lz4');
        const simdTime = benchmark(simdInstance, data, 'compress_lz4');
        const speedup = baseTime / simdTime;
        
        const baseSpeed = (sizeMB / (baseTime / 1000)).toFixed(1);
        const simdSpeed = (sizeMB / (simdTime / 1000)).toFixed(1);
        
        console.log(`| ${name} | ${baseTime.toFixed(2)} | ${simdTime.toFixed(2)} | ${baseSpeed} MB/s | ${simdSpeed} MB/s | ${speedup.toFixed(2)}x |`);
    }
    
    console.log('\n');
}

main().catch(console.error);


// Node.js SIMD vs Base benchmark
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

function benchmark(instance, data, abi, runs = 5) {
    // Warmup
    for (let i = 0; i < 2; i++) {
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
    const items = [];
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    const cities = ['New York', 'London', 'Tokyo', 'Paris', 'Sydney', 'Berlin'];
    
    while (JSON.stringify(items).length < size) {
        items.push({
            id: Math.floor(Math.random() * 1000000),
            name: names[Math.floor(Math.random() * names.length)],
            email: `user${items.length}@example.com`,
            city: cities[Math.floor(Math.random() * cities.length)],
            score: Math.random() * 100,
            active: Math.random() > 0.5,
        });
    }
    
    const jsonStr = JSON.stringify(items);
    return new TextEncoder().encode(jsonStr.slice(0, size));
}

async function main() {
    const size = 1024 * 1024; // 1MB
    const data = generateTestData(size);
    const sizeMB = data.length / 1024 / 1024;
    
    console.log(`\n🔬 SIMD vs Base WASM Benchmark`);
    console.log(`Input size: ${(data.length / 1024).toFixed(1)} KB\n`);
    
    const tests = [
        { name: 'Brotli', level: 1, abi: 'compress_brotli_level_1', 
          base: '../js/brotli/dist/wasm/brotli.base.wasm',
          simd: '../js/brotli/dist/wasm/brotli.simd.wasm' },
        { name: 'Brotli', level: 4, abi: 'compress_brotli_level_4',
          base: '../js/brotli/dist/wasm/brotli.base.wasm',
          simd: '../js/brotli/dist/wasm/brotli.simd.wasm' },
        { name: 'Gzip', level: 1, abi: 'compress_gzip_level_1',
          base: '../js/gzip/dist/wasm/gzip.base.wasm',
          simd: '../js/gzip/dist/wasm/gzip.simd.wasm' },
        { name: 'Gzip', level: 6, abi: 'compress_gzip_level_6',
          base: '../js/gzip/dist/wasm/gzip.base.wasm',
          simd: '../js/gzip/dist/wasm/gzip.simd.wasm' },
        { name: 'LZ4 Frame', level: '-', abi: 'compress_lz4',
          base: '../js/lz4/dist/wasm/lz4.base.wasm',
          simd: '../js/lz4/dist/wasm/lz4.simd.wasm' },
        { name: 'LZ4 Block', level: '-', abi: 'compress_lz4_block',
          base: '../js/lz4/dist/wasm/lz4.base.wasm',
          simd: '../js/lz4/dist/wasm/lz4.simd.wasm' },
    ];
    
    console.log('| Codec | Level | Base (ms) | SIMD (ms) | Base Speed | SIMD Speed | Speedup |');
    console.log('|-------|-------|-----------|-----------|------------|------------|---------|');
    
    for (const test of tests) {
        const basePath = path.join(__dirname, test.base);
        const simdPath = path.join(__dirname, test.simd);
        
        const baseInstance = await loadWasm(basePath);
        const simdInstance = await loadWasm(simdPath);
        
        const baseTime = benchmark(baseInstance, data, test.abi);
        const simdTime = benchmark(simdInstance, data, test.abi);
        const speedup = baseTime / simdTime;
        
        const baseSpeed = (sizeMB / (baseTime / 1000)).toFixed(1);
        const simdSpeed = (sizeMB / (simdTime / 1000)).toFixed(1);
        
        console.log(`| ${test.name} | ${test.level} | ${baseTime.toFixed(2)} | ${simdTime.toFixed(2)} | ${baseSpeed} MB/s | ${simdSpeed} MB/s | ${speedup.toFixed(2)}x |`);
    }
    
    console.log('\n');
}

main().catch(console.error);


/**
 * Comprehensive benchmark using Silesia corpus
 * Tests gzip, brotli, and lz4 at various compression levels
 * 
 * Measures:
 * - Compression speed (MB/s)
 * - Compression ratio (%)
 * - Time per file
 */

import { readFile, readdir } from 'fs/promises';
import { statSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import compression libraries
import { init as initGzip, compress as compressGzip } from '../js/gzip/dist/node.js';
import { init as initBrotli, compress as compressBrotli } from '../js/brotli/dist/node.js';
import { init as initLz4, compress as compressLz4 } from '../js/lz4/dist/node.js';

// Import comparison libraries
import pako from 'pako';
import { compress as brotliCompress } from 'brotli';
import { compress as lz4jsCompress } from 'lz4js';

const SILESIA_DIR = join(__dirname, '..', 'test-data', 'silesia');

// Compression levels to test
const gzipLevels = [1, 3, 6, 9];
const brotliLevels = [1, 4, 6, 9, 11];
const lz4Levels = [1, 4, 9, 16];

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format time in milliseconds
 */
function formatTime(ms) {
  if (ms < 1) return (ms * 1000).toFixed(2) + ' μs';
  if (ms < 1000) return ms.toFixed(2) + ' ms';
  return (ms / 1000).toFixed(2) + ' s';
}

/**
 * Calculate compression ratio
 */
function compressionRatio(original, compressed) {
  return ((1 - compressed.length / original.length) * 100).toFixed(2);
}

/**
 * Benchmark a compression function
 */
async function benchmarkCompression(name, fn, data, iterations = 3) {
  // Warmup
  for (let i = 0; i < 2; i++) {
    try {
      await fn(data);
    } catch (e) {
      // Ignore
    }
  }

  const times = [];
  const sizes = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await fn(data);
    const end = performance.now();
    
    times.push(end - start);
    const size = result instanceof Uint8Array ? result.length : result.byteLength || result.length;
    sizes.push(size);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const inputSizeMB = data.length / (1024 * 1024);
  const throughput = inputSizeMB / (avgTime / 1000);

  return {
    name,
    avgTime,
    avgSize,
    throughput,
    compressionRatio: compressionRatio(data, new Uint8Array([avgSize]))
  };
}

/**
 * Test gzip compression
 */
async function testGzip(data, level) {
  await initGzip();
  
  const wfc = await benchmarkCompression(
    `@addmaple/gzip (level ${level})`,
    (d) => compressGzip(d, { level }),
    data
  );
  
  const pakoResult = await benchmarkCompression(
    `pako (level ${level})`,
    (d) => pako.gzip(d, { level }),
    data
  );
  
  return { wfc, pako: pakoResult };
}

/**
 * Test brotli compression
 */
async function testBrotli(data, level) {
  await initBrotli();
  
  const wfc = await benchmarkCompression(
    `@addmaple/brotli (level ${level})`,
    (d) => compressBrotli(d, { level }),
    data
  );
  
  const js = await benchmarkCompression(
    `brotli npm (level ${level})`,
    (d) => {
      const result = brotliCompress(d, { quality: level });
      return result instanceof Uint8Array ? result : new Uint8Array(result);
    },
    data
  );
  
  return { wfc, js };
}

/**
 * Test lz4 compression
 */
async function testLz4(data, level) {
  await initLz4();
  
  const wfc = await benchmarkCompression(
    `@addmaple/lz4 (level ${level})`,
    (d) => compressLz4(d, { level }),
    data
  );
  
  const js = await benchmarkCompression(
    `lz4js (accel ${level})`,
    (d) => {
      const result = lz4jsCompress(d, { acceleration: level });
      return result instanceof Uint8Array ? result : new Uint8Array(result);
    },
    data
  );
  
  return { wfc, js };
}

/**
 * Test a single file
 */
async function testFile(filePath, fileName) {
  const data = await readFile(filePath);
  const fileSize = data.length;
  
  console.log(`\n${'='.repeat(100)}`);
  console.log(`File: ${fileName} (${formatBytes(fileSize)})`);
  console.log('='.repeat(100));

  const results = {
    fileName,
    fileSize,
    gzip: {},
    brotli: {},
    lz4: {}
  };

  // Test Gzip
  console.log('\n📦 GZIP:');
  console.log('-'.repeat(100));
  for (const level of gzipLevels) {
    const { wfc, pako } = await testGzip(data, level);
    results.gzip[level] = { wfc, pako };
    
    console.log(`\nLevel ${level}:`);
    console.log(`  @addmaple/gzip: ${formatTime(wfc.avgTime)} | ${wfc.throughput.toFixed(2)} MB/s | ${wfc.compressionRatio}% ratio | ${formatBytes(wfc.avgSize)}`);
    console.log(`  pako:      ${formatTime(pako.avgTime)} | ${pako.throughput.toFixed(2)} MB/s | ${pako.compressionRatio}% ratio | ${formatBytes(pako.avgSize)}`);
    const speedup = pako.avgTime / wfc.avgTime;
    console.log(`  Speed: ${speedup > 1 ? '@addmaple/gzip' : 'pako'} is ${Math.max(speedup, 1/speedup).toFixed(2)}x faster`);
  }

  // Test Brotli
  console.log('\n📦 BROTLI:');
  console.log('-'.repeat(100));
  for (const level of brotliLevels) {
    const { wfc, js } = await testBrotli(data, level);
    results.brotli[level] = { wfc, js };
    
    console.log(`\nLevel ${level}:`);
    console.log(`  @addmaple/brotli: ${formatTime(wfc.avgTime)} | ${wfc.throughput.toFixed(2)} MB/s | ${wfc.compressionRatio}% ratio | ${formatBytes(wfc.avgSize)}`);
    console.log(`  brotli npm:  ${formatTime(js.avgTime)} | ${js.throughput.toFixed(2)} MB/s | ${js.compressionRatio}% ratio | ${formatBytes(js.avgSize)}`);
    const speedup = js.avgTime / wfc.avgTime;
    console.log(`  Speed: ${speedup > 1 ? '@addmaple/brotli' : 'brotli npm'} is ${Math.max(speedup, 1/speedup).toFixed(2)}x faster`);
  }

  // Test LZ4
  console.log('\n📦 LZ4:');
  console.log('-'.repeat(100));
  for (const level of lz4Levels) {
    const { wfc, js } = await testLz4(data, level);
    results.lz4[level] = { wfc, js };
    
    console.log(`\nLevel ${level}:`);
    console.log(`  @addmaple/lz4: ${formatTime(wfc.avgTime)} | ${wfc.throughput.toFixed(2)} MB/s | ${wfc.compressionRatio}% ratio | ${formatBytes(wfc.avgSize)}`);
    console.log(`  lz4js:    ${formatTime(js.avgTime)} | ${js.throughput.toFixed(2)} MB/s | ${js.compressionRatio}% ratio | ${formatBytes(js.avgSize)}`);
    const speedup = js.avgTime / wfc.avgTime;
    console.log(`  Speed: ${speedup > 1 ? '@addmaple/lz4' : 'lz4js'} is ${Math.max(speedup, 1/speedup).toFixed(2)}x faster`);
  }

  return results;
}

/**
 * Generate summary statistics
 */
function generateSummary(allResults) {
  console.log(`\n${'='.repeat(100)}`);
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(100));

  // Calculate averages across all files
  const totals = {
    gzip: { wfc: { time: 0, throughput: 0, ratio: 0 }, pako: { time: 0, throughput: 0, ratio: 0 } },
    brotli: { wfc: { time: 0, throughput: 0, ratio: 0 }, js: { time: 0, throughput: 0, ratio: 0 } },
    lz4: { wfc: { time: 0, throughput: 0, ratio: 0 }, js: { time: 0, throughput: 0, ratio: 0 } }
  };

  let fileCount = 0;
  for (const result of allResults) {
    fileCount++;
    
    // Gzip averages
    for (const level of gzipLevels) {
      if (result.gzip[level]) {
        totals.gzip.wfc.time += result.gzip[level].wfc.avgTime;
        totals.gzip.wfc.throughput += result.gzip[level].wfc.throughput;
        totals.gzip.wfc.ratio += parseFloat(result.gzip[level].wfc.compressionRatio);
        totals.gzip.pako.time += result.gzip[level].pako.avgTime;
        totals.gzip.pako.throughput += result.gzip[level].pako.throughput;
        totals.gzip.pako.ratio += parseFloat(result.gzip[level].pako.compressionRatio);
      }
    }
    
    // Brotli averages
    for (const level of brotliLevels) {
      if (result.brotli[level]) {
        totals.brotli.wfc.time += result.brotli[level].wfc.avgTime;
        totals.brotli.wfc.throughput += result.brotli[level].wfc.throughput;
        totals.brotli.wfc.ratio += parseFloat(result.brotli[level].wfc.compressionRatio);
        totals.brotli.js.time += result.brotli[level].js.avgTime;
        totals.brotli.js.throughput += result.brotli[level].js.throughput;
        totals.brotli.js.ratio += parseFloat(result.brotli[level].js.compressionRatio);
      }
    }
    
    // LZ4 averages
    for (const level of lz4Levels) {
      if (result.lz4[level]) {
        totals.lz4.wfc.time += result.lz4[level].wfc.avgTime;
        totals.lz4.wfc.throughput += result.lz4[level].wfc.throughput;
        totals.lz4.wfc.ratio += parseFloat(result.lz4[level].wfc.compressionRatio);
        totals.lz4.js.time += result.lz4[level].js.avgTime;
        totals.lz4.js.throughput += result.lz4[level].js.throughput;
        totals.lz4.js.ratio += parseFloat(result.lz4[level].js.compressionRatio);
      }
    }
  }

  const levelCounts = {
    gzip: gzipLevels.length,
    brotli: brotliLevels.length,
    lz4: lz4Levels.length
  };

  console.log('\n📊 Average Performance Across All Files:');
  console.log('\nGZIP:');
  console.log(`  @addmaple/gzip: ${formatTime(totals.gzip.wfc.time / (fileCount * levelCounts.gzip))} avg | ${(totals.gzip.wfc.throughput / (fileCount * levelCounts.gzip)).toFixed(2)} MB/s avg | ${(totals.gzip.wfc.ratio / (fileCount * levelCounts.gzip)).toFixed(2)}% avg ratio`);
  console.log(`  pako:      ${formatTime(totals.gzip.pako.time / (fileCount * levelCounts.gzip))} avg | ${(totals.gzip.pako.throughput / (fileCount * levelCounts.gzip)).toFixed(2)} MB/s avg | ${(totals.gzip.pako.ratio / (fileCount * levelCounts.gzip)).toFixed(2)}% avg ratio`);

  console.log('\nBROTLI:');
  console.log(`  @addmaple/brotli: ${formatTime(totals.brotli.wfc.time / (fileCount * levelCounts.brotli))} avg | ${(totals.brotli.wfc.throughput / (fileCount * levelCounts.brotli)).toFixed(2)} MB/s avg | ${(totals.brotli.wfc.ratio / (fileCount * levelCounts.brotli)).toFixed(2)}% avg ratio`);
  console.log(`  brotli npm:  ${formatTime(totals.brotli.js.time / (fileCount * levelCounts.brotli))} avg | ${(totals.brotli.js.throughput / (fileCount * levelCounts.brotli)).toFixed(2)} MB/s avg | ${(totals.brotli.js.ratio / (fileCount * levelCounts.brotli)).toFixed(2)}% avg ratio`);

  console.log('\nLZ4:');
  console.log(`  @addmaple/lz4: ${formatTime(totals.lz4.wfc.time / (fileCount * levelCounts.lz4))} avg | ${(totals.lz4.wfc.throughput / (fileCount * levelCounts.lz4)).toFixed(2)} MB/s avg | ${(totals.lz4.wfc.ratio / (fileCount * levelCounts.lz4)).toFixed(2)}% avg ratio`);
  console.log(`  lz4js:    ${formatTime(totals.lz4.js.time / (fileCount * levelCounts.lz4))} avg | ${(totals.lz4.js.throughput / (fileCount * levelCounts.lz4)).toFixed(2)} MB/s avg | ${(totals.lz4.js.ratio / (fileCount * levelCounts.lz4)).toFixed(2)}% avg ratio`);
}

/**
 * Main benchmark runner
 */
async function runBenchmarks() {
  console.log('Silesia Corpus Compression Benchmark');
  console.log('='.repeat(100));
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Architecture: ${process.arch}`);
  console.log(`Test directory: ${SILESIA_DIR}`);

  // Check if directory exists
  try {
    const files = await readdir(SILESIA_DIR);
    const testFiles = files.filter(f => {
      const filePath = join(SILESIA_DIR, f);
      try {
        const stats = statSync(filePath);
        return f === 'large.json' && 
               stats.isFile() &&
               stats.size > 0;
      } catch {
        return false;
      }
    }).sort();
    
    if (testFiles.length === 0) {
      console.error(`\n❌ No test files found in ${SILESIA_DIR}`);
      console.error('Please download the Silesia corpus first.');
      process.exit(1);
    }

    console.log(`\nFound ${testFiles.length} test files`);
    console.log('Initializing compression libraries...\n');
    
    // Initialize all libraries
    await Promise.all([
      initGzip(),
      initBrotli(),
      initLz4()
    ]);
    
    console.log('✓ All libraries initialized\n');

    const allResults = [];
    
    // Test each file
    for (const fileName of testFiles) {
      const filePath = join(SILESIA_DIR, fileName);
      try {
        const result = await testFile(filePath, fileName);
        allResults.push(result);
      } catch (error) {
        console.error(`\n❌ Error testing ${fileName}:`, error.message || error.toString() || error);
        if (error.stack) {
          console.error('Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
        }
      }
    }

    // Generate summary
    generateSummary(allResults);

    console.log(`\n✅ Benchmark complete! Tested ${allResults.length} files.`);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`\n❌ Directory not found: ${SILESIA_DIR}`);
      console.error('Please download the Silesia corpus first.');
    } else {
      console.error('\n❌ Error:', error);
    }
    process.exit(1);
  }
}

// Run benchmarks
runBenchmarks().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});


/**
 * Minimal Brotli performance suite
 * Focuses on Silesia corpus files above a configurable size (default 128 KB) for quick iterations.
 * Compares @addmaple/brotli vs the brotli npm package at key quality levels.
 */

import { readFile, readdir } from 'fs/promises';
import { statSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { init as initBrotli, compress as compressBrotli, getLoadedVariant } from '../js/brotli/dist/node.js';
import { compress as brotliCompress } from 'brotli';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SILESIA_DIR = join(__dirname, '..', 'test-data', 'silesia');
const MIN_FILE_SIZE_BYTES = Number(process.env.BROTLI_MIN_SIZE || 128 * 1024); // default 128 KB
const MAX_FILES = Number(process.env.BROTLI_MAX_FILES || 3);
const PREFER_SIMD = !['0', 'false', 'no'].includes(String(process.env.BROTLI_PREFER_SIMD || '').toLowerCase());
const BROTLI_LEVELS = (process.env.BROTLI_LEVELS || '1,4,6,9,11').split(',').map(Number);
const ITERATIONS = 5; // keep runtime short but stable

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function compressionRatio(originalSize, compressedSize) {
  return ((1 - compressedSize / originalSize) * 100).toFixed(2);
}

async function benchmark(label, fn, data, iterations = ITERATIONS) {
  // warmup
  try {
    await fn(data);
  } catch {
    // ignore warmup errors
  }

  const timings = [];
  const sizes = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await fn(data);
    const end = performance.now();

    const buffer = result instanceof Uint8Array ? result : new Uint8Array(result);
    timings.push(end - start);
    sizes.push(buffer.length);
  }

  const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const throughput = (data.length / (1024 * 1024)) / (avgTime / 1000);

  return {
    label,
    avgTime,
    avgSize,
    throughput,
    ratio: compressionRatio(data.length, avgSize)
  };
}

async function testFile(entry) {
  const data = await readFile(entry.path);
  const originalSize = data.length;

  console.log(`\n${'='.repeat(100)}`);
  console.log(`File: ${entry.name} (${formatBytes(entry.size)})`);
  console.log('='.repeat(100));

  const results = {};

  for (const level of BROTLI_LEVELS) {
    const wfc = await benchmark(
      `@addmaple/brotli (level ${level})`,
      (d) => compressBrotli(d, { level }),
      data
    );

    const js = await benchmark(
      `brotli npm (level ${level})`,
      (d) => {
        const output = brotliCompress(d, { quality: level });
        return output instanceof Uint8Array ? output : new Uint8Array(output);
      },
      data
    );

    const speedMultiplier = (wfc.avgTime < js.avgTime)
      ? (js.avgTime / wfc.avgTime)
      : (wfc.avgTime / js.avgTime);
    const faster = wfc.avgTime <= js.avgTime ? '@addmaple/brotli' : 'brotli npm';

    console.log(`\nLevel ${level}:`);
    console.log(`  @addmaple/brotli: ${formatTime(wfc.avgTime)} | ${wfc.throughput.toFixed(2)} MB/s | ${wfc.ratio}% ratio`);
    console.log(`  brotli npm: ${formatTime(js.avgTime)} | ${js.throughput.toFixed(2)} MB/s | ${js.ratio}% ratio`);
    console.log(`  ${faster} is ${speedMultiplier.toFixed(2)}x faster`);

    results[level] = { wfc, js };
  }

  return { fileName: entry.name, size: originalSize, levels: results };
}

function summarize(allResults) {
  console.log(`\n${'='.repeat(100)}`);
  console.log('SUMMARY (avg across files)');
  console.log('='.repeat(100));

  const totals = BROTLI_LEVELS.reduce((acc, level) => {
    acc[level] = { wfcTime: 0, jsTime: 0, count: 0 };
    return acc;
  }, {});

  for (const result of allResults) {
    for (const level of BROTLI_LEVELS) {
      const entry = result.levels[level];
      if (!entry) continue;
      totals[level].wfcTime += entry.wfc.avgTime;
      totals[level].jsTime += entry.js.avgTime;
      totals[level].count += 1;
    }
  }

  for (const level of BROTLI_LEVELS) {
    const { wfcTime, jsTime, count } = totals[level];
    if (!count) continue;
    const wfcAvg = wfcTime / count;
    const jsAvg = jsTime / count;
    const faster = wfcAvg <= jsAvg ? '@addmaple/brotli' : 'brotli npm';
    const mult = wfcAvg <= jsAvg ? (jsAvg / wfcAvg) : (wfcAvg / jsAvg);

    console.log(`Level ${level}: ${faster} ${mult.toFixed(2)}x faster on average (${count} files)`);
  }
}

async function runSuite() {
  console.log(`Minimal Brotli Criterion Suite (>= ${formatBytes(MIN_FILE_SIZE_BYTES)} files)`);
  console.log('='.repeat(100));
  console.log(`Node.js: ${process.version}`);
  console.log(`Corpus dir: ${SILESIA_DIR}`);
  console.log(`@addmaple/brotli preferSIMD: ${PREFER_SIMD}`);

  const files = await readdir(SILESIA_DIR);
  const FILE_FILTERS = (process.env.BROTLI_FILE_FILTER || '').split(',').filter(Boolean);
  const candidateEntries = files.map((file) => {
    if (file.startsWith('.') || file.endsWith('.zip')) return null;
    if (FILE_FILTERS.length > 0 && !FILE_FILTERS.some(filter => file.toLowerCase().includes(filter.toLowerCase()))) return null;
    const filePath = join(SILESIA_DIR, file);
    try {
      const stats = statSync(filePath);
      if (stats.isFile() && stats.size >= MIN_FILE_SIZE_BYTES) {
        return { name: file, path: filePath, size: stats.size };
      }
    } catch {
      return null;
    }
    return null;
  }).filter(Boolean).sort((a, b) => a.size - b.size);

  if (candidateEntries.length === 0) {
    console.error(`No files >= ${formatBytes(MIN_FILE_SIZE_BYTES)} found in ${SILESIA_DIR}`);
    process.exit(1);
  }

  const selectedEntries = candidateEntries.slice(0, MAX_FILES);
  console.log(`Testing ${selectedEntries.length} files (>= ${formatBytes(MIN_FILE_SIZE_BYTES)}), ${ITERATIONS} iteration(s) each. (max ${MAX_FILES}, total candidates ${candidateEntries.length})`);

  await initBrotli({ preferSIMD: PREFER_SIMD });
  const variant = getLoadedVariant();
  console.log(`@addmaple/brotli variant: ${variant}`);
  if (variant !== 'simd') {
    console.warn('⚠️ SIMD build not active; falling back to base WASM.');
  }
  const results = [];

  for (const entry of selectedEntries) {
    try {
      const result = await testFile(entry);
      results.push(result);
    } catch (error) {
      console.error(`\n❌ Error processing ${entry.name}: ${error.message || error}`);
    }
  }

  summarize(results);
  console.log(`\n✅ Completed ${results.length} files.`);
}

runSuite().catch((error) => {
  console.error('Suite failed:', error);
  process.exit(1);
});


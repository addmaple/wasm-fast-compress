import assert from 'node:assert/strict'

import {
  // LZ4
  createCompressionStream as createLz4CompressionStream,
  createDecompressionStream as createLz4DecompressionStream,
  compressStream as lz4CompressStream,
  decompressStream as lz4DecompressStream,
} from '../js/lz4/dist/node.js'

import {
  // Gzip
  createCompressionStream as createGzipCompressionStream,
  createDecompressionStream as createGzipDecompressionStream,
  compressStream as gzipCompressStream,
  decompressStream as gzipDecompressStream,
} from '../js/gzip/dist/node.js'

function concatU8(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.byteLength
  }
  return out
}

function makeReadableStream(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c)
      controller.close()
    },
  })
}

async function collectReadable(readable) {
  const reader = readable.getReader()
  const chunks = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return concatU8(chunks)
}

async function testLz4StreamHelpers() {
  // No init() call on purpose: should lazy-init
  const enc = new TextEncoder()
  const chunks = [
    enc.encode('Hello, '),
    enc.encode('streaming '),
    enc.encode('LZ4 '),
    enc.encode('world!'),
  ]
  const original = concatU8(chunks)

  // API 1: pipeThrough(createCompressionStream())
  {
    const src = makeReadableStream(chunks)
    const compressed = src.pipeThrough(createLz4CompressionStream())
    const decompressed = compressed.pipeThrough(createLz4DecompressionStream())
    const out = await collectReadable(decompressed)
    assert.deepEqual(out, original)
  }

  // API 2: compressStream()/decompressStream() helpers
  {
    const src = makeReadableStream(chunks)
    const decompressed = lz4DecompressStream(lz4CompressStream(src))
    const out = await collectReadable(decompressed)
    assert.deepEqual(out, original)
  }
}

async function testGzipStreamHelpers() {
  // No init() call on purpose: should lazy-init
  const enc = new TextEncoder()
  const chunks = [
    enc.encode('Hello, '),
    enc.encode('streaming '),
    enc.encode('gzip '),
    enc.encode('world!'),
  ]
  const original = concatU8(chunks)

  // API 1: pipeThrough(createCompressionStream())
  {
    const src = makeReadableStream(chunks)
    const compressed = src.pipeThrough(createGzipCompressionStream({ level: 6 }))
    const decompressed = compressed.pipeThrough(createGzipDecompressionStream())
    const out = await collectReadable(decompressed)
    assert.deepEqual(out, original)
  }

  // API 2: compressStream()/decompressStream() helpers
  {
    const src = makeReadableStream(chunks)
    const decompressed = gzipDecompressStream(gzipCompressStream(src, { level: 6 }))
    const out = await collectReadable(decompressed)
    assert.deepEqual(out, original)
  }
}

async function main() {
  console.log('🧪 stream helper tests')
  await testLz4StreamHelpers()
  console.log('✅ lz4 stream helpers')
  await testGzipStreamHelpers()
  console.log('✅ gzip stream helpers')
}

main().catch((err) => {
  console.error('❌ stream helper tests failed')
  console.error(err)
  process.exit(1)
})


// Browser Example - Gzip Compression
// Note: In a real app, you would use:
// import { init, compress } from '@addmaple/gzip';

// For this example to work locally without publishing to npm, 
// we use a relative path to the generated browser loader.
import { init, compress } from '../../js/gzip/dist/browser.js';

const inputEl = document.getElementById('input');
const btn = document.getElementById('compress-btn');
const origSizeEl = document.getElementById('orig-size');
const compSizeEl = document.getElementById('comp-size');
const timeEl = document.getElementById('time');
const ratioEl = document.getElementById('ratio');
const outputEl = document.getElementById('output');

async function main() {
    console.log('Initializing WASM...');
    // In browser, this will automatically detect SIMD support 
    // and fetch the appropriate .wasm file.
    await init();
    console.log('WASM initialized.');

    btn.addEventListener('click', async () => {
        const text = inputEl.value;
        const input = new TextEncoder().encode(text);
        
        origSizeEl.textContent = `${input.length} bytes`;

        const start = performance.now();
        const compressed = await compress(input, { level: 6 });
        const end = performance.now();

        const duration = end - start;
        const ratio = (1 - compressed.length / input.length) * 100;

        compSizeEl.textContent = `${compressed.length} bytes`;
        timeEl.textContent = `${duration.toFixed(2)} ms`;
        ratioEl.textContent = `${ratio.toFixed(2)}%`;

        // Convert to Base64 for display
        const base64 = btoa(String.fromCharCode.apply(null, compressed));
        outputEl.textContent = base64;
    });
}

main().catch(err => {
    console.error('Initialization failed:', err);
    outputEl.textContent = `Error: ${err.message}`;
});


# Key points for an HN post: “Why don’t we compress HTTP requests?”

### Thesis
- **It’s weird that we compress responses by default but upload raw payloads from the browser.**
- **For many apps, request payloads are the *big* bytes** (sync batches, analytics, editor state, pasted text into chatbots, etc.).
- **Client→server compression can save bandwidth and time** (especially on mobile uplink) with **very low CPU cost** when using a fast codec like LZ4 + SIMD.

### What “request compression” means (practically)
- **Client** compresses the request body (often JSON) into a `Uint8Array` and sends it as `application/octet-stream`.
- **Server** decompresses, then parses the decoded payload (e.g. JSON).
- **Key detail**: unlike response compression, most stacks do **not** do request decompression automatically.

### Reproducible demo + numbers (the “show me” section)
- There’s a working browser→Express example: `examples/lz4-upload/`.
- Observed results on JSON (from the example’s table):
  - **10K records**: **1.44 MB → 310 KB (21%)**, client compress **6ms**
  - **100K records**: **14.56 MB → 3.05 MB (21%)**, client compress **26ms**
  - Server-side decompression shows **hundreds of MB/s** throughput.
- The pitch: **~5× bandwidth savings** on JSON at **millisecond-level CPU overhead** for multi-MB payloads.

### Why LZ4 (and not “just gzip everything”)
- **LZ4 is built for speed**, and SIMD makes it even cheaper on modern browsers/CPUs.
- For request bodies, “fast + good-enough ratio” usually beats “max ratio but expensive.”
- Your docs already show **WASM LZ4 is 2.5×–3.5× faster than `lz4js`** (a pure JS alternative).

### The honest caveats (preempt the top HN objections)
- **Small payloads**: below ~**50KB**, WASM can lose because JS↔WASM copy overhead dominates.
  - Practical fix: **thresholding** (only compress above 32–64KB, tune per app).
- **Bundle / fetch overhead**:
  - Default browser loader fetches both SIMD and base WASM then instantiates the best one.
  - If you want “no extra requests”, use the **inline build** (`@addmaple/lz4/inline`) which embeds WASM bytes directly in JS.
- **Security**: request decompression must be **hardened** (or attackers can send decompression bombs).
  - Require **strict limits** (max compressed size, max decompressed size, max ratio, timeouts).
- **Not all uploads benefit**:
  - Already-compressed formats (JPEG/PNG/MP4/PDF) won’t shrink much.
  - Text/JSON/CSV/logs and “pasted text into chat” typically compress a lot.

### Why it isn’t the default today (the “why hasn’t the web fixed this?” section)
- **Responses are easy**: browsers advertise `Accept-Encoding`, servers have off-the-shelf middleware.
- **Requests are not**: clients must opt in and servers/frameworks/gateways must explicitly decompress safely.
- **Operational friction**: logging, observability, API gateways, and debugging tools often assume request bodies are plain JSON.

### The “sane default” proposal (actionable + not scary)
- **Compress requests above a threshold** (ex: 64KB) using a fast codec (LZ4).
- **Server ships a standard middleware**: “decompress request bodies safely” with guardrails.
- **Keep it explicit**:
  - Either standard `Content-Encoding` (e.g. `lz4`) if you control the stack
  - Or a simple app-level convention: binary body + `X-Content-Codec: lz4` (or similar)

### Short FAQ / rebuttals (copy-paste answers)
- **“CPU/battery cost!”**
  - True in general; use **thresholding** and a **fast codec**. On slow uplinks, fewer bytes can reduce wall-time (and radio time), often winning overall.
- **“This breaks caches/proxies/etc.”**
  - Most request bodies aren’t cached anyway; for APIs behind gateways, you just need a standardized approach and tooling support.
- **“Just use gzip Content-Encoding.”**
  - You can, but it’s not turnkey in many client/server frameworks, and the safe-decompression story is the missing piece.
- **“10KB payloads aren’t worth it.”**
  - Often correct; don’t compress tiny bodies. This is about the many apps sending **50KB–MB** request bodies routinely.

### Suggested “one-sentence” opener (HN style)
- **“We all gzip responses by default, but we still upload raw JSON—why isn’t safe request compression a standard middleware?”**



#!/bin/bash
set -e

# Build script for all WASM codecs using wasm-bindgen-lite
# This builds both base and SIMD versions of each codec as configured in wasm-bindgen-lite.config.json

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WBL_BIN="${BASE_DIR}/node_modules/.bin/wasm-bindgen-lite"

echo "Building WASM modules using wasm-bindgen-lite..."

# Function to build a codec
build_codec() {
    local codec=$1
    local binding_dir="bindings/${codec}-wasm"
    local extra_env=""
    
    echo "Building ${codec}..."

    # brotli requires nightly for portable-SIMD
    if [ "${codec}" = "brotli" ]; then
        extra_env="RUSTUP_TOOLCHAIN=nightly"
    fi
    
    cd "${BASE_DIR}/${binding_dir}"
    env ${extra_env} "${WBL_BIN}" build --crate . --release
    cd "${BASE_DIR}"
    
    echo "  ${codec} build complete"
}

# Build all codecs
build_codec "gzip"
build_codec "brotli"
build_codec "lz4"

echo "All builds complete!"

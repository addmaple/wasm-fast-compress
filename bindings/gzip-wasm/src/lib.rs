use codec_gzip::GzipCompressor;
use core_api::{CompressionOptions, Compressor, Flush};
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::LazyLock;
use std::io::Read;

// --- wasm-bindgen-lite bindings ---

#[no_mangle]
pub unsafe extern "C" fn alloc_bytes(len: usize) -> *mut u8 {
    use std::alloc::{alloc, Layout};
    let layout = Layout::from_size_align(len, std::mem::align_of::<u8>()).unwrap();
    alloc(layout)
}

#[no_mangle]
pub unsafe extern "C" fn free_bytes(ptr: *mut u8, len: usize) {
    use std::alloc::{dealloc, Layout};
    let layout = Layout::from_size_align(len, std::mem::align_of::<u8>()).unwrap();
    dealloc(ptr, layout);
}

// Static storage for streaming compressors
static COMPRESSORS: LazyLock<Mutex<HashMap<u32, GzipCompressor>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static DECOMPRESSORS: LazyLock<Mutex<HashMap<u32, GzipDecompressorState>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static mut HANDLE_COUNTER: u32 = 1;

fn next_handle() -> u32 {
    unsafe {
        let handle = HANDLE_COUNTER;
        HANDLE_COUNTER += 1;
        handle
    }
}

// ============================================================================
// Streaming Decompression API
// ============================================================================

use flate2::bufread::GzDecoder;
use std::io::Cursor;

struct GzipDecompressorState {
    decoder: GzDecoder<Cursor<Vec<u8>>>,
    // Pending decompressed bytes not yet returned to JS
    pending: Vec<u8>,
    pending_offset: usize,
    done: bool,
}

impl GzipDecompressorState {
    fn new() -> Self {
        let cursor = Cursor::new(Vec::new());
        let decoder = GzDecoder::new(cursor);
        Self {
            decoder,
            pending: Vec::new(),
            pending_offset: 0,
            done: false,
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn create_gzip_decompressor() -> u32 {
    let handle = next_handle();
    DECOMPRESSORS.lock().unwrap().insert(handle, GzipDecompressorState::new());
    handle
}

#[no_mangle]
pub unsafe extern "C" fn destroy_gzip_decompressor(handle: u32) {
    DECOMPRESSORS.lock().unwrap().remove(&handle);
}

#[no_mangle]
pub unsafe extern "C" fn decompress_gzip_chunk(
    handle: u32,
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
    finish: u8,
) -> isize {
    let mut decompressors = DECOMPRESSORS.lock().unwrap();
    let state = match decompressors.get_mut(&handle) {
        Some(s) => s,
        None => return -1,
    };

    // If we already have pending output, drain that first.
    if state.pending_offset < state.pending.len() {
        let remaining = state.pending.len() - state.pending_offset;
        let to_copy = remaining.min(out_len);
        if to_copy > 0 {
            std::ptr::copy_nonoverlapping(
                state.pending.as_ptr().add(state.pending_offset),
                out_ptr,
                to_copy,
            );
            state.pending_offset += to_copy;
            // If fully drained, reset buffer to avoid unbounded growth.
            if state.pending_offset >= state.pending.len() {
                state.pending.clear();
                state.pending_offset = 0;
            }
            return to_copy as isize;
        }
        return 0;
    }

    // Append new compressed input to the underlying cursor buffer.
    if in_len > 0 {
        let input = std::slice::from_raw_parts(in_ptr, in_len);
        let cursor = state.decoder.get_mut();
        cursor.get_mut().extend_from_slice(input);
    }

    // Try to read some decompressed output.
    // Read into a temporary buffer and either return it immediately or stash it.
    let mut buf = vec![0u8; out_len.max(8192)];
    match state.decoder.read(&mut buf) {
        Ok(0) => {
            // End of stream (or nothing available). If finish, close handle.
            state.done = true;
            if finish != 0 {
                decompressors.remove(&handle);
            }
            0
        }
        Ok(n) => {
            buf.truncate(n);
            // If caller out buffer is smaller than what we read (can happen if out_len < 8192),
            // store remainder and return partial. Otherwise return all.
            if n > out_len {
                let to_copy = out_len;
                std::ptr::copy_nonoverlapping(buf.as_ptr(), out_ptr, to_copy);
                state.pending = buf;
                state.pending_offset = to_copy;
                to_copy as isize
            } else {
                std::ptr::copy_nonoverlapping(buf.as_ptr(), out_ptr, n);
                n as isize
            }
        }
        Err(e) => {
            // For incomplete streams, flate2 typically reports UnexpectedEof.
            if e.kind() == std::io::ErrorKind::UnexpectedEof {
                if finish != 0 {
                    decompressors.remove(&handle);
                    return -1;
                }
                return 0;
            }
            if finish != 0 {
                decompressors.remove(&handle);
            }
            -1
        }
    }
}

unsafe fn compress_gzip_raw(
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
    level: u32,
) -> isize {
    let input = std::slice::from_raw_parts(in_ptr, in_len);
    let opts = CompressionOptions {
        level: Some(level),
        ..Default::default()
    };
    
    match <GzipCompressor as Compressor>::compress_all(input, opts) {
        Ok(out) => {
            if out.len() > out_len {
                return -(out.len() as isize);
            }
            std::ptr::copy_nonoverlapping(out.as_ptr(), out_ptr, out.len());
            out.len() as isize
        }
        Err(_) => -1,
    }
}

#[no_mangle]
pub unsafe extern "C" fn compress_gzip_level_1(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_gzip_raw(p, l, o, ol, 1)
}

#[no_mangle]
pub unsafe extern "C" fn compress_gzip_level_6(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_gzip_raw(p, l, o, ol, 6)
}

#[no_mangle]
pub unsafe extern "C" fn compress_gzip_level_9(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_gzip_raw(p, l, o, ol, 9)
}

// ============================================================================
// Streaming Compression API
// ============================================================================

#[no_mangle]
pub unsafe extern "C" fn create_gzip_compressor(level: u32) -> u32 {
    let handle = next_handle();
    let opts = CompressionOptions {
        level: Some(level),
        ..Default::default()
    };
    match GzipCompressor::new(opts) {
        Ok(compressor) => {
            COMPRESSORS.lock().unwrap().insert(handle, compressor);
            handle
        }
        Err(_) => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn compress_gzip_chunk(
    handle: u32,
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
    finish: u8,
) -> isize {
    let mut compressors = COMPRESSORS.lock().unwrap();
    let compressor = match compressors.get_mut(&handle) {
        Some(c) => c,
        None => return -1,
    };

    let input = std::slice::from_raw_parts(in_ptr, in_len);
    let flush = if finish != 0 { Flush::Finish } else { Flush::None };

    match compressor.compress_chunk(input, flush) {
        Ok(out) => {
            if out.is_empty() {
                return 0;
            }
            if out.len() > out_len {
                return -(out.len() as isize);
            }
            std::ptr::copy_nonoverlapping(out.as_ptr(), out_ptr, out.len());
            let result = out.len() as isize;
            if finish != 0 {
                compressors.remove(&handle);
            }
            result
        }
        Err(_) => -1,
    }
}

#[no_mangle]
pub unsafe extern "C" fn destroy_gzip_compressor(handle: u32) {
    COMPRESSORS.lock().unwrap().remove(&handle);
}

// ============================================================================
// Decompression API
// ============================================================================

#[no_mangle]
pub unsafe extern "C" fn decompress_gzip(
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
) -> isize {
    let input = std::slice::from_raw_parts(in_ptr, in_len);
    let mut decoder = flate2::read::GzDecoder::new(input);
    let mut output = Vec::new();
    
    match decoder.read_to_end(&mut output) {
        Ok(_) => {
            if output.len() > out_len {
                return -(output.len() as isize);
            }
            std::ptr::copy_nonoverlapping(output.as_ptr(), out_ptr, output.len());
            output.len() as isize
        }
        Err(_) => -1,
    }
}

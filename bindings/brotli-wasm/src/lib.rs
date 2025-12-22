use codec_brotli::BrotliCompressor;
use core_api::{CompressionOptions, Compressor, Flush};
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::LazyLock;

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
static COMPRESSORS: LazyLock<Mutex<HashMap<u32, BrotliCompressor>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static mut HANDLE_COUNTER: u32 = 1;

fn next_handle() -> u32 {
    unsafe {
        let handle = HANDLE_COUNTER;
        HANDLE_COUNTER += 1;
        handle
    }
}

unsafe fn compress_brotli_raw(
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
    
    match <BrotliCompressor as Compressor>::compress_all(input, opts) {
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
pub unsafe extern "C" fn compress_brotli_level_1(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_brotli_raw(p, l, o, ol, 1)
}

#[no_mangle]
pub unsafe extern "C" fn compress_brotli_level_4(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_brotli_raw(p, l, o, ol, 4)
}

#[no_mangle]
pub unsafe extern "C" fn compress_brotli_level_6(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_brotli_raw(p, l, o, ol, 6)
}

#[no_mangle]
pub unsafe extern "C" fn compress_brotli_level_9(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_brotli_raw(p, l, o, ol, 9)
}

// ============================================================================
// Streaming Compression API
// ============================================================================

#[no_mangle]
pub unsafe extern "C" fn create_brotli_compressor(level: u32) -> u32 {
    let handle = next_handle();
    let opts = CompressionOptions {
        level: Some(level),
        ..Default::default()
    };
    match BrotliCompressor::new(opts) {
        Ok(compressor) => {
            COMPRESSORS.lock().unwrap().insert(handle, compressor);
            handle
        }
        Err(_) => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn compress_brotli_chunk(
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
pub unsafe extern "C" fn destroy_brotli_compressor(handle: u32) {
    COMPRESSORS.lock().unwrap().remove(&handle);
}

// ============================================================================
// Decompression API
// ============================================================================

#[no_mangle]
pub unsafe extern "C" fn decompress_brotli(
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
) -> isize {
    use std::io::Read;
    
    let input = std::slice::from_raw_parts(in_ptr, in_len);
    let mut decoder = brotli::Decompressor::new(input, 4096);
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

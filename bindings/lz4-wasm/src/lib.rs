use codec_lz4::Lz4Compressor;
use core_api::{CompressionOptions, Compressor, Flush};
use std::collections::HashMap;
use std::io::Read;
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

// For streaming decompression, we accumulate compressed data in a buffer
struct DecompressorState {
    buffer: Vec<u8>,
}

// Static storage for streaming compressors and decompressors
static COMPRESSORS: LazyLock<Mutex<HashMap<u32, Lz4Compressor>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static DECOMPRESSORS: LazyLock<Mutex<HashMap<u32, DecompressorState>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static mut HANDLE_COUNTER: u32 = 1;

fn next_handle() -> u32 {
    unsafe {
        let handle = HANDLE_COUNTER;
        HANDLE_COUNTER += 1;
        handle
    }
}

// LZ4 is a single-speed algorithm - no compression levels
#[no_mangle]
pub unsafe extern "C" fn compress_lz4(
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
) -> isize {
    let input = std::slice::from_raw_parts(in_ptr, in_len);
    let opts = CompressionOptions::default();
    
    match <Lz4Compressor as Compressor>::compress_all(input, opts) {
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

// Streaming compression API
#[no_mangle]
pub unsafe extern "C" fn create_compressor() -> u32 {
    let handle = next_handle();
    let opts = CompressionOptions::default();
    match Lz4Compressor::new(opts) {
        Ok(compressor) => {
            COMPRESSORS.lock().unwrap().insert(handle, compressor);
            handle
        }
        Err(_) => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn compress_chunk(
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
pub unsafe extern "C" fn destroy_compressor(handle: u32) {
    COMPRESSORS.lock().unwrap().remove(&handle);
}

// ============================================================================
// Block API - Raw LZ4 compression without frame overhead (maximum speed)
// ============================================================================

/// Compress using raw LZ4 block format (no frame headers, no checksums)
/// This is the fastest option but output is not compatible with standard LZ4 tools
#[no_mangle]
pub unsafe extern "C" fn compress_lz4_block(
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
) -> isize {
    let input = std::slice::from_raw_parts(in_ptr, in_len);
    let compressed = lz4_flex::block::compress(input);
    
    if compressed.len() > out_len {
        return -(compressed.len() as isize);
    }
    std::ptr::copy_nonoverlapping(compressed.as_ptr(), out_ptr, compressed.len());
    compressed.len() as isize
}

/// Decompress raw LZ4 block format
/// Requires knowing the uncompressed size in advance
#[no_mangle]
pub unsafe extern "C" fn decompress_lz4_block(
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
) -> isize {
    let input = std::slice::from_raw_parts(in_ptr, in_len);
    
    match lz4_flex::block::decompress(input, out_len) {
        Ok(decompressed) => {
            if decompressed.len() > out_len {
                return -(decompressed.len() as isize);
            }
            std::ptr::copy_nonoverlapping(decompressed.as_ptr(), out_ptr, decompressed.len());
            decompressed.len() as isize
        }
        Err(_) => -1,
    }
}

// ============================================================================
// Frame API - Standard LZ4 frame format (compatible with standard tools)
// ============================================================================

// Decompression API
#[no_mangle]
pub unsafe extern "C" fn decompress_lz4(
    in_ptr: *const u8,
    in_len: usize,
    out_ptr: *mut u8,
    out_len: usize,
) -> isize {
    let input = std::slice::from_raw_parts(in_ptr, in_len);
    let mut output = Vec::new();
    
    match lz4_flex::frame::FrameDecoder::new(std::io::Cursor::new(input.to_vec())).read_to_end(&mut output) {
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

#[no_mangle]
pub unsafe extern "C" fn create_decompressor() -> u32 {
    let handle = next_handle();
    let state = DecompressorState {
        buffer: Vec::new(),
    };
    DECOMPRESSORS.lock().unwrap().insert(handle, state);
    handle
}

#[no_mangle]
pub unsafe extern "C" fn decompress_chunk(
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

    let input = std::slice::from_raw_parts(in_ptr, in_len);
    state.buffer.extend_from_slice(input);

    // If finish is set, create decoder and read all data
    if finish != 0 {
        let mut output = Vec::new();
        match lz4_flex::frame::FrameDecoder::new(std::io::Cursor::new(state.buffer.clone())).read_to_end(&mut output) {
            Ok(_) => {
                if output.len() > out_len {
                    return -(output.len() as isize);
                }
                if !output.is_empty() {
                    std::ptr::copy_nonoverlapping(output.as_ptr(), out_ptr, output.len());
                }
                let result = output.len() as isize;
                decompressors.remove(&handle);
                result
            }
            Err(_) => {
                decompressors.remove(&handle);
                -1
            }
        }
    } else {
        // For non-finish chunks, we can't produce output until we have a complete frame
        // LZ4 frame format requires the full frame to decode, so return 0 until finish
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn destroy_decompressor(handle: u32) {
    DECOMPRESSORS.lock().unwrap().remove(&handle);
}

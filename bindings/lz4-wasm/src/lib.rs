use codec_lz4::Lz4Compressor;
use core_api::{CompressionOptions, Compressor};

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

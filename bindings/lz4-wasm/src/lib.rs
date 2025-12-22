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

unsafe fn compress_lz4_raw(
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

#[no_mangle]
pub unsafe extern "C" fn compress_lz4_level_1(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_lz4_raw(p, l, o, ol, 1)
}

#[no_mangle]
pub unsafe extern "C" fn compress_lz4_level_9(p: *const u8, l: usize, o: *mut u8, ol: usize) -> isize {
    compress_lz4_raw(p, l, o, ol, 9)
}

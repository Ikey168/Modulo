// Example Modulo blueprint node (action.wasm.execute, ABI v1 — ADR 0003).
//
// Emits word/character statistics for the note content:
//   "<title> — N words, M chars"
//
// Build: cargo build --release --target wasm32-unknown-unknown
// The wasm32-unknown-unknown target with panic=abort produces a module with
// zero imports, as the contract requires. No external crates — the envelope
// is parsed with a minimal extractor to keep the example dependency-free.

use std::alloc::{alloc as raw_alloc, Layout};

/// Host asks for a buffer to place the input envelope in.
///
/// # Safety
/// The host writes exactly `size` bytes before calling `execute`; the
/// instance is discarded after one call, so nothing is ever freed.
#[no_mangle]
pub extern "C" fn alloc(size: i32) -> i32 {
    unsafe { raw_alloc(Layout::from_size_align(size as usize, 1).unwrap()) as i32 }
}

/// Run the node: read the envelope, produce the output text.
#[no_mangle]
pub extern "C" fn execute(in_ptr: i32, in_len: i32) -> i64 {
    let input = unsafe { std::slice::from_raw_parts(in_ptr as *const u8, in_len as usize) };
    let json = String::from_utf8_lossy(input);

    let title = extract_string_field(&json, "title");
    let content = extract_string_field(&json, "content");

    let words = content.split_whitespace().count();
    let chars = content.chars().count();
    let out = format!("{title} — {words} words, {chars} chars");

    let bytes = out.into_bytes();
    let len = bytes.len() as i64;
    let ptr = bytes.as_ptr() as i64;
    std::mem::forget(bytes); // the host copies the result out, then drops the instance
    (ptr << 32) | len
}

/// Minimal JSON string-field extractor for the v1 envelope (flat, known
/// shape). Handles JSON escapes; real modules are welcome to use serde.
fn extract_string_field(json: &str, field: &str) -> String {
    let needle = format!("\"{field}\"");
    let Some(start) = json.find(&needle) else { return String::new() };
    let rest = &json[start + needle.len()..];
    let Some(colon) = rest.find(':') else { return String::new() };
    let Some(quote) = rest[colon..].find('"') else { return String::new() };
    let mut chars = rest[colon + quote + 1..].chars();
    let mut out = String::new();
    while let Some(c) = chars.next() {
        match c {
            '"' => break,
            '\\' => match chars.next() {
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some('r') => out.push('\r'),
                Some('b') => out.push('\u{0008}'),
                Some('f') => out.push('\u{000C}'),
                Some('u') => {
                    let hex: String = chars.by_ref().take(4).collect();
                    if let Ok(code) = u32::from_str_radix(&hex, 16) {
                        if let Some(ch) = char::from_u32(code) {
                            out.push(ch);
                        }
                    }
                }
                Some(other) => out.push(other),
                None => break,
            },
            _ => out.push(c),
        }
    }
    out
}

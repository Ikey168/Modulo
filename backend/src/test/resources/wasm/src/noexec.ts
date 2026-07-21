// Invalid fixture: missing the execute export — must be rejected at validation.
export function alloc(size: i32): i32 {
  return i32(__new(<usize>size, idof<ArrayBuffer>()));
}

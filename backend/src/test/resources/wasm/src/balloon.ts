// Hostile fixture: allocates until the declared memory maximum traps.
export function alloc(size: i32): i32 {
  return i32(__new(<usize>size, idof<ArrayBuffer>()));
}

export function execute(inPtr: i32, inLen: i32): i64 {
  let total: i64 = 0;
  while (true) {
    const buf = new ArrayBuffer(1024 * 1024);
    total += buf.byteLength;
  }
  return total;
}

// Hostile fixture: execute() never returns. Built with the same flags as the
// conforming fixtures (see README.md in the parent directory).
export function alloc(size: i32): i32 {
  return i32(__new(<usize>size, idof<ArrayBuffer>()));
}

export function execute(inPtr: i32, inLen: i32): i64 {
  let x: i64 = 0;
  while (true) {
    x = (x + 1) % 7;
  }
  return x;
}

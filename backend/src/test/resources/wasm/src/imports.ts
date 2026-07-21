// Invalid fixture: declares a host import — must be rejected at validation.
@external("env", "hostEscape")
declare function hostEscape(): void;

export function alloc(size: i32): i32 {
  return i32(__new(<usize>size, idof<ArrayBuffer>()));
}

export function execute(inPtr: i32, inLen: i32): i64 {
  hostEscape();
  return 0;
}

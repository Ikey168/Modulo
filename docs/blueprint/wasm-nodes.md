# Writing `action.wasm.execute` modules

The WASM Module blueprint node runs a compiled WebAssembly module against the
current note and emits the module's text output on its `output` pin. Modules
can be written in any language that compiles to core WASM — this guide plus
the two reference modules in `examples/wasm-nodes/` are everything an author
needs. The contract is fixed by
[ADR 0003](../architecture/adr-0003-wasm-execute-module-contract.md).

## The ABI (v1)

Your module must export exactly three things and import **nothing**:

| Export | Signature | What it does |
|--------|-----------|--------------|
| `memory` | linear memory | shared address space (most toolchains export it by default) |
| `alloc` | `(size: i32) -> i32` | return a pointer to `size` writable bytes; the host writes the input envelope there |
| `execute` | `(ptr: i32, len: i32) -> i64` | run the node; return `(result_ptr << 32) \| result_len` |

Lifecycle per execution: the host instantiates your module fresh, calls
`alloc(len)`, writes the envelope, calls `execute(ptr, len)`, copies the
result bytes out, and **discards the instance**. Consequences worth
internalizing:

- No `dealloc` is needed, ever. A bump allocator that never frees is a fully
  conforming `alloc`.
- No state survives between executions. Globals reset every run.
- Returning a pointer into your own memory is safe — the host copies before
  the instance dies.

## Input and output

`execute` receives UTF-8 JSON:

```json
{"v": 1, "note": {"title": "…", "content": "…"}}
```

New fields may appear over time (additive-only); parse leniently. The return
buffer is raw UTF-8 text — not JSON — and lands verbatim on the node's
`output` pin, truncated beyond 64 KiB.

## The rules validation enforces

Modules are validated when the blueprint is saved; each failure names its
rule in the editor:

| Rule | Requirement | Typical fix |
|------|-------------|-------------|
| `SIZE` | binary ≤ 512 KiB | build in release mode with size optimization (`-Oz`, `--shrinkLevel 2`) |
| `PARSE` | valid core WASM | you uploaded something else |
| `IMPORTS` | zero imports, WASI included | AssemblyScript: `--use abort=`; Rust: `wasm32-unknown-unknown` + `panic = "abort"`; TinyGo: not import-free — see the support matrix |
| `EXPORTS` | `memory`, `alloc`, `execute` with the exact v1 signatures | check `#[no_mangle]` / `export function` names and types |
| `MEMORY_MAX` | declared memory maximum ≤ 512 pages (32 MiB) | AssemblyScript: `--maximumMemory 512`; Rust: link-arg `--max-memory=33554432` |

## Runtime limits

Same regime as the Custom Code node: 2 s wall clock and a 200M-instruction
fuel budget (whichever trips first), memory bounded by your declared maximum,
64 KiB output. Limit breaches and traps produce empty node output and a
warning in the execution log — they never fail the blueprint run.

## Walkthrough: from source to running node

1. Copy a reference module:
   - `examples/wasm-nodes/assemblyscript` — TypeScript-like, lowest friction
     (`npm install && npm run build`).
   - `examples/wasm-nodes/rust` — `cargo build --release --target
     wasm32-unknown-unknown` (toolchain and memory flags are pinned in the
     example's `rust-toolchain.toml` / `.cargo/config.toml`).
2. Implement your transform in `execute` (both examples show a minimal
   envelope parser; serde/JSON libraries are fine if you stay under 512 KiB).
3. In the blueprint editor, drop a **WASM Module** node, click **Attach
   .wasm module…**, and select your binary. The editor shows name, size, and
   SHA-256 (compare it against `sha256sum your.wasm` — what runs is exactly
   what you built) and rejects oversized/non-WASM files before upload.
4. Wire `note` in and `output` onward, save, grant the `wasm:execute`
   capability when prompted.

## Toolchain support matrix

| Toolchain | Status |
|-----------|--------|
| AssemblyScript (`--runtime stub --use abort= --maximumMemory 512`) | **Tested** — reference module, rebuilt in CI |
| Rust (`wasm32-unknown-unknown`, `panic = "abort"`, `--max-memory`) | **Tested** — reference module, rebuilt in CI |
| Go / TinyGo | **Untested.** TinyGo's `wasm-unknown` target still emits runtime imports in common configurations, which the `IMPORTS` rule rejects. If you get an import-free build working, please contribute it as a third example. |
| C / Zig (freestanding) | Untested but expected to work — both can emit import-free core WASM with exported functions. |

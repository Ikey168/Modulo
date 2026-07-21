# Example `action.wasm.execute` modules

Reference implementations of the WASM blueprint-node ABI
([ADR 0003](../../docs/architecture/adr-0003-wasm-execute-module-contract.md);
author guide: [docs/blueprint/wasm-nodes.md](../../docs/blueprint/wasm-nodes.md)).

| Directory | Language | Node behavior | Build |
|-----------|----------|---------------|-------|
| `assemblyscript/` | AssemblyScript | title-cases the note title | `npm install && npm run build` → `build/titlecase.wasm` |
| `rust/` | Rust | word/char stats for the note content | `cargo build --release --target wasm32-unknown-unknown` |

These are not just documentation: their build outputs are checked in as the
backend's conformance fixtures (`backend/src/test/resources/wasm/`), where
`WasmNodeTest` validates and executes them, and the `wasm-node-examples` CI
job rebuilds both from source and fails on any byte drift. Changing an
example, its toolchain pin, or the ABI therefore means re-copying the built
binaries into the fixtures directory in the same commit:

```sh
cp assemblyscript/build/titlecase.wasm ../../backend/src/test/resources/wasm/titlecase.wasm
cp rust/target/wasm32-unknown-unknown/release/modulo_wasm_node_wordstats.wasm \
   ../../backend/src/test/resources/wasm/wordstats.wasm
```

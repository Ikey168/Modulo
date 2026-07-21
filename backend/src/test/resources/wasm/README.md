# WASM test fixtures for `action.wasm.execute` (#403)

| File | Source | Role |
|------|--------|------|
| `titlecase.wasm` | `examples/wasm-nodes/assemblyscript` | conforming module (AssemblyScript) |
| `wordstats.wasm` | `examples/wasm-nodes/rust` | conforming module (Rust) |
| `loop.wasm` | `src/loop.ts` | hostile: `execute` never returns |
| `balloon.wasm` | `src/balloon.ts` | hostile: allocates to the memory cap |
| `imports.wasm` | `src/imports.ts` | invalid: declares a host import |
| `noexec.wasm` | `src/noexec.ts` | invalid: missing the `execute` export |
| `nomax.wasm` | `src/loop.ts` built **without** `--maximumMemory` | invalid: no declared memory maximum |

The conforming fixtures are copies of the example modules' build output — they
are the ABI's conformance artifacts (ADR 0003); the CI workflow rebuilds the
examples and fails if the rebuilt binaries drift from these copies.

Rebuild the local-source fixtures with the AssemblyScript compiler from
`examples/wasm-nodes/assemblyscript`:

```sh
ASC=examples/wasm-nodes/assemblyscript/node_modules/.bin/asc
FLAGS="--optimizeLevel 3 --shrinkLevel 2 --runtime stub --use abort= --maximumMemory 512"
$ASC src/loop.ts    -o loop.wasm    $FLAGS
$ASC src/balloon.ts -o balloon.wasm $FLAGS
$ASC src/imports.ts -o imports.wasm $FLAGS
$ASC src/noexec.ts  -o noexec.wasm  $FLAGS
$ASC src/loop.ts    -o nomax.wasm   --optimizeLevel 3 --shrinkLevel 2 --runtime stub --use abort=
```

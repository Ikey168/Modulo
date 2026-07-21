# The WASM script sandbox

How `action.code.execute` scripts run when `modulo.blueprint.sandbox=wasm`
(#397–#401), what the engine actually is, how the resource limits map from the
Rhino implementation, and the cutover runbook.

## What runs where

The user's JavaScript is **not** compiled to WASM. The engine is a JavaScript
interpreter (QuickJS) that is itself compiled to WebAssembly; the user script
runs unmodified inside it. That keeps the authoring contract byte-for-byte
identical to the Rhino engine:

```js
function(note) {
  // note.title: string, note.content: string (read-only)
  return note.title.toUpperCase();
}
```

## Engine provenance

| Layer | What | Where from |
|-------|------|-----------|
| Java API | `WasmScriptSandbox` | `backend/.../blueprint/sandbox/` |
| Bindings + engine | `io.roastedroot:quickjs4j:0.1.0` | Maven Central (SHA-512 verified by Maven on download) |
| JS engine | QuickJS-NG, compiled to `wasm32-wasi` as the Bytecode Alliance **Javy** plugin | embedded in quickjs4j, AOT-precompiled |
| WASM runtime | **Endive** (Chicory-family pure-Java runtime); the Javy plugin module is AOT-compiled to JVM bytecode at quickjs4j build time | transitive dependency of quickjs4j |

No native code and no JNI anywhere in the chain — the stack is pure JVM
bytecode, so the arm64/Raspberry-Pi path (#386) needs nothing special.

quickjs4j builds the module from `javy_quickjs4j_plugin.wasm` (see its
published POM's `endive-compiler-maven-plugin` configuration); upgrading the
engine means bumping the quickjs4j version, never swapping an opaque binary
in-repo.

## Isolation model

- **Deny-by-default.** A WASM instance starts with nothing: the only linked
  imports are the runtime's own WASI shims for stdout/stderr capture. There is
  no `java`/`Packages` (never existed, unlike Rhino where they are stripped),
  no `fetch`/`XMLHttpRequest`, no filesystem, no clock beyond what QuickJS
  itself provides.
- **Fresh world per execution.** A new engine instance (fresh linear memory)
  is created per call and discarded after. Nothing is pooled; prototype
  pollution or global leaks cannot survive into the next run.
- **Result channel.** The wrapper prints the ToString-coerced result on stdout
  behind a per-execution random marker; user `console.log` noise cannot be
  mistaken for the result.

## Resource limits: Rhino → WASM mapping (#399)

| Concern | Rhino engine | WASM engine |
|---------|--------------|-------------|
| CPU | 500 000 interpreted instructions (`observeInstructionCount`) | **wall-clock budget** (see deviation below) |
| Wall clock | 2 s, checked in the instruction observer | 2 s, enforced by the runner's executor (`withTimeoutMs`) |
| Memory | none (bounded only indirectly by the instruction limit) | **hard cap: 512 pages = 32 MiB** linear memory via the runtime memory factory; QuickJS's internal guards (e.g. "string too long") usually trip first |
| Output size | 64 KiB + `[truncated]` | identical, host-side |

**Deviation — no per-instruction fuel.** The Javy plugin module ships
AOT-compiled to JVM bytecode, which executes without an interpreter loop, so
there is no per-instruction hook to count fuel with. The CPU bound is therefore
the wall-clock budget. This is a deliberate trade: AOT execution is what makes
per-call instantiation cheap enough to give every run a fresh world, and the
2 s wall clock plus the 32 MiB memory cap bound the damage a hostile script can
do at least as tightly as Rhino's instruction count did. (In the extracted
sandbox-service deployment of #393, pod CPU limits add a further outer wall.)

## Calibration (measured, JDK 21, x86_64 container)

| Workload | WASM engine |
|----------|-------------|
| Engine instantiation + trivial script | ~15 ms |
| 20 000-iteration string-append loop | ~230 ms |
| Memory balloon (string doubling) | aborted safely at ~100 ms |
| Infinite `while(true)` | aborted at ~2.04 s (timeout) |

For comparison, Rhino's 500k-instruction budget aborts a `while(true){}` in
well under 100 ms; the WASM engine lets a hot loop run until the wall clock.
The *worst-case* CPU a hostile script can consume rises from ~100 ms to 2 s per
execution; the *typical* script is unaffected. If that ceiling ever matters,
lower `withTimeoutMs` — do not try to re-add fuel counting to an AOT module.

Semantic differences between the engines are tracked in
[wasm-sandbox-drift.md](wasm-sandbox-drift.md); the mechanical parity gate is
`ScriptSandboxContractTest`, which runs every contract assertion against both
implementations.

## Rollout state and runbook (#401)

1. **Canary (current):** default `rhino`; the `dev` profile sets
   `modulo.blueprint.sandbox=wasm` (`application-dev.properties`). Soak until
   real blueprint traffic has exercised `action.code.execute` on wasm across a
   release cycle.
2. **Flip:** change the default in `application.yml` to `wasm`. Keep `rhino`
   selectable for one release as the escape hatch. Release note: engine changes
   from Rhino's dialect to QuickJS (ES2020-compliant — strictly more standard);
   scripts gain a hard 32 MiB memory cap; see the drift log.
3. **Retire:** delete `RhinoScriptSandbox`, the `org.mozilla:rhino` dependency
   in `backend/pom.xml`, and the `rhino` case in `ScriptSandboxConfig` (unknown
   values already fail startup). The `ScriptSandbox` interface stays — it is
   the seam the external-plugin sandbox extraction (#393) routes through.

# JS semantics drift: Rhino → QuickJS-on-WASM

The intentional, verified behavioral differences between the two
`ScriptSandbox` engines (#400). Everything *not* listed here is required to
behave identically — the mechanical gate is the drift corpus in
`ScriptSandboxContractTest`, which asserts byte-identical output on both
engines for realistic scripts. This log is the source material for the #401
cutover release note.

## Language semantics

| Script | Rhino | QuickJS (wasm) | Verdict |
|--------|-------|----------------|---------|
| `parseInt('08')` | `NaN` (pre-ES5 octal leniency) | `8` | QuickJS is ES5+ spec-correct; scripts relying on Rhino's `NaN` must use an explicit radix (`parseInt('08', 10)` behaves identically on both) |
| destructuring / shorthand properties / spread (`const {title} = note`, `[...s]`) | syntax error (`missing : after property id`) at the language version the sandbox runs Rhino with | works (ES2020) | drift only unbreaks scripts; nothing that ran on Rhino changes |

QuickJS is ES2020-compliant; Rhino 1.7.15 predates parts of ES2015+. Scripts
using modern syntax that Rhino cannot parse (e.g. optional chaining `?.`)
fail on Rhino and work on wasm — this direction of drift only makes
previously-broken scripts start working, so it is not release-note-worthy
per script feature.

## Resource-limit behavior

| Scenario | Rhino | QuickJS (wasm) |
|----------|-------|----------------|
| `while(true) {}` | aborted by the 500k-instruction limit, typically < 100 ms | aborted by the 2 s wall-clock budget (no fuel metering on the AOT module — see wasm-sandbox.md) |
| Deep recursion | bounded at 1 000 interpreter frames (`setMaximumInterpreterStackDepth`) | bounded by QuickJS's internal stack guard (`InternalError: stack overflow`) |
| Memory balloon | **no hard cap** — bounded only indirectly by the instruction limit | 32 MiB linear-memory cap; QuickJS internal guards (e.g. "string too long") usually trip first |

Both engines surface every limit breach as `ScriptExecutionException`; the
message wording differs (`instruction limit` / `stack depth` vs
`wall-clock timeout` / guest error text). Blueprint behavior is identical —
the interpreter treats any `ScriptExecutionException` as empty output.

## Findings credited to the contract suite

- **Rhino recursion OOM (fixed):** before #400, `function f(n){return f(n)}`
  heap-OOMed the JVM after ~2 minutes — interpreter frames are heap-allocated,
  so the instruction limit never tripped and there was no stack-depth guard.
  The suite's `deepRecursionFailsSafely` exposed it; `RhinoScriptSandbox` now
  sets `setMaximumInterpreterStackDepth(1000)`.
- **quickjs4j timeout leak (worked around):** the runner's `withTimeoutMs`
  abandons the caller but leaves the guest thread spinning forever.
  `WasmScriptSandbox` therefore enforces the deadline itself by interrupting
  the engine thread (`Future.cancel(true)`) — the AOT-compiled module checks
  interruption at loop back-edges and dies cleanly (verified).

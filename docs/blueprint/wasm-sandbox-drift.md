# JS semantics drift: Rhino → QuickJS-on-WASM

Historical comparison of the intentional, verified behavioral differences
between the retired Rhino sandbox and the QuickJS-on-WASM implementation
(#400/#401). Rhino is no longer selectable at runtime; this document remains as
the migration reference for scripts written before the cutover. The current
`ScriptSandboxContractTest` is WASM-only and protects the supported behavior and
resource limits after retirement.

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

The supported WASM engine surfaces every limit breach as
`ScriptExecutionException`; Blueprint execution treats that failure as empty
output. Rhino wording in the table is retained only to help migrate historical
scripts and logs.

## Findings credited to the contract suite

- **Rhino recursion OOM (historical):** before #400, `function f(n){return f(n)}`
  heap-OOMed the JVM after ~2 minutes — interpreter frames are heap-allocated,
  so the instruction limit never tripped and there was no stack-depth guard.
  The parity suite exposed it and the legacy engine gained a stack-depth guard
  before being removed in #401.
- **quickjs4j timeout leak (worked around):** the runner's `withTimeoutMs`
  abandons the caller but leaves the guest thread spinning forever.
  `WasmScriptSandbox` therefore enforces the deadline itself by interrupting
  the engine thread (`Future.cancel(true)`) — the AOT-compiled module checks
  interruption at loop back-edges and dies cleanly (verified).

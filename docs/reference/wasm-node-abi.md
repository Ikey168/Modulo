# WASM node ABI and script sandbox

This page is the contract for code that runs inside a Blueprint. It covers the
module ABI for `action.wasm.execute`, which runs compiled WebAssembly, and the
QuickJS-on-WASM engine behind `action.code.execute`, which runs JavaScript. It is
written for module authors and for reviewers of sandbox changes. The decision
record is ADR 0003 in [decisions](../architecture/decisions.md). For the WASM
cutover runbook, see [Runbooks](../operations/runbooks.md).

Code:

| Concern | Class |
| --- | --- |
| Module validation | [`WasmModuleValidator`](../../backend/src/main/java/com/modulo/blueprint/wasm/WasmModuleValidator.java) |
| Module execution | [`WasmNodeExecutor`](../../backend/src/main/java/com/modulo/blueprint/wasm/WasmNodeExecutor.java) |
| JavaScript engine | [`WasmScriptSandbox`](../../backend/src/main/java/com/modulo/blueprint/sandbox/WasmScriptSandbox.java) |
| Engine selection | [`ScriptSandboxConfig`](../../backend/src/main/java/com/modulo/blueprint/sandbox/ScriptSandboxConfig.java) |
| Remote routing | [`RemoteScriptSandbox`](../../backend/src/main/java/com/modulo/blueprint/sandbox/RemoteScriptSandbox.java) |
| Editor upload checks | [`BlueprintNodeView.tsx`](../../frontend/src/features/blueprint/editor/BlueprintNodeView.tsx) (`readWasmModuleFile`) |
| Reference modules | [`examples/wasm-nodes/`](../../examples/wasm-nodes/) |

## Module ABI (v1)

A module is raw core WebAssembly, not a component-model component. It must export
exactly these three items and import nothing:

| Export | Signature | Purpose |
| --- | --- | --- |
| `memory` | linear memory | The shared address space for input and output. Most toolchains export it by default. |
| `alloc` | `(size: i32) -> i32` | Returns a pointer to `size` writable bytes. The host writes the input envelope there. |
| `execute` | `(ptr: i32, len: i32) -> i64` | Runs the node and returns `(result_ptr << 32) \| result_len`. |

The high 32 bits of the `execute` result are the pointer to the result bytes in
the module's memory. The low 32 bits are the byte length.

### Lifecycle

Each execution follows the same steps:

1. The host creates a fresh instance of the module, with fresh linear memory.
2. It calls `alloc(len)` and writes the UTF-8 input envelope at the returned pointer.
3. It calls `execute(ptr, len)`.
4. It copies `len` bytes from the returned pointer.
5. It discards the instance.

This has three consequences:

- A module never needs `dealloc`. A bump allocator that never frees is a valid `alloc`.
- Nothing survives between executions. Globals reset on every run.
- Returning a pointer into the module's own memory is safe, because the host
  copies the bytes before the instance goes away.

A negative result length, or a pointer and length that fall outside memory, is an
ABI violation and fails the node.

### Input envelope

`execute` receives UTF-8 JSON:

```json
{"v": 1, "note": {"title": "…", "content": "…"}}
```

`title` and `content` are always strings, and an empty string stands for a missing
value. The envelope only ever gains fields, so parse it leniently. A breaking
change would ship as a new export name, such as `execute_v2`, so that v1 modules
keep working.

### Output

The result bytes are raw UTF-8 text, not JSON. They land unchanged on the node's
`output` pin. Output longer than 65,536 characters is cut at that length and
`[truncated]` is appended.

## Validation rules

The backend validates a module the first time a Blueprint runs it, and caches the
parsed module after that. It checks the rules in order, and the first failure
names its rule:

| Rule | Requirement | Typical fix |
| --- | --- | --- |
| `SIZE` | Not empty, and at most 512 KiB (524,288 bytes) | Build in release mode with size optimization (`-Oz`, `--shrinkLevel 2`) |
| `PARSE` | Valid core WASM | The file is not a WebAssembly module |
| `IMPORTS` | No imports at all, WASI included | AssemblyScript: `--use abort=` and `--runtime stub`. Rust: `wasm32-unknown-unknown` with `panic = "abort"`. |
| `EXPORTS` | `memory`, `alloc`, and `execute` with the exact v1 signatures | Check the export names and types, such as `#[no_mangle]` or `export function` |
| `MEMORY_MAX` | A linear memory is declared, with a maximum of at most 512 pages (32 MiB). A module with no declared maximum is rejected. | AssemblyScript: `--maximumMemory 512`. Rust: link argument `--max-memory=33554432`. |

The editor rejects oversized files and files without the `\0asm` magic bytes
before upload. It also shows the file name, size, and SHA-256 of the attached
module. Compare the hash with `sha256sum your.wasm`: what runs is exactly what
you built. The validator computes the same SHA-256.

A module is stored inline as base64 in the node's `config.module`, next to
`config.moduleName`, so it travels with the Blueprint IR. The 512 KiB cap is fixed
on purpose. If a real module outgrows it, the planned answer is
content-addressed artifact storage, not a larger inline cap.

## Runtime limits

User modules run in the Chicory interpreter (`com.dylibso.chicory:runtime`), not
AOT-compiled, so that an untrusted binary can always be aborted.

| Limit | Value | Enforcement |
| --- | --- | --- |
| Wall clock | 2 s | Checked every 16,384 instructions in an execution listener |
| Instructions (fuel) | 200,000,000 | Same listener |
| Memory | The declared maximum, at most 32 MiB | Static, enforced by validation |
| Output | 65,536 characters, plus `[truncated]` | Host-side |

A limit breach, a trap such as `unreachable`, an out-of-bounds access, or
`memory.grow` past the maximum, an instantiation failure, or an ABI violation
fails the step with `WASM_FAILURE`. The run then fails with `NODE_FAILURE`. There
is no silent empty output. See
[Workflows and approvals](../features/workflows-and-approvals.md) for how failed
runs are recorded and retried.

## Trust model

A module is untrusted by construction and is exactly as privileged as a custom
script: no network, filesystem, clock, or host callbacks. Import-free validation
and the runtime limits are the enforcement. The `wasm:execute` capability is the
authorization, granted per Blueprint like `code:execute`. Modules are not signed
or checked for provenance, because they run with zero privileges.

## Writing a module

1. Copy a reference module from [`examples/wasm-nodes/`](../../examples/wasm-nodes/):
   - `assemblyscript/` title-cases the note title. Build it with
     `npm install && npm run build`, which produces `build/titlecase.wasm`.
   - `rust/` computes word and character statistics for the note content. Build it
     with `cargo build --release --target wasm32-unknown-unknown`. The toolchain
     and memory flags are pinned in `rust-toolchain.toml` and `.cargo/config.toml`.
2. Implement your transform in `execute`. Both examples include a minimal
   envelope parser. A JSON library is fine as long as the binary stays under 512 KiB.
3. In the Blueprint editor, add a **WASM Module** node, choose
   **Attach .wasm module…**, and select your binary.
4. Wire `note` in and `output` onward, save, and grant `wasm:execute` when the
   consent screen asks.

The example build outputs are also the backend's conformance fixtures in
`backend/src/test/resources/wasm/`, where `WasmNodeTest` validates and runs them.
The `wasm-node-examples` CI job rebuilds both examples from source and fails if
the bytes drift. If you change an example, its toolchain pin, or the ABI, copy the
rebuilt binaries into the fixtures directory in the same commit. The commands are
in [`examples/wasm-nodes/README.md`](../../examples/wasm-nodes/README.md).

### Toolchain support

| Toolchain | Status |
| --- | --- |
| AssemblyScript (`--runtime stub --use abort= --maximumMemory 512`) | Tested: reference module, rebuilt in CI |
| Rust (`wasm32-unknown-unknown`, `panic = "abort"`, `--max-memory=33554432`) | Tested: reference module, rebuilt in CI |
| TinyGo | Untested. Common configurations of its `wasm-unknown` target still emit runtime imports, which the `IMPORTS` rule rejects. |
| C, Zig (freestanding) | Untested. Both can emit import-free core WASM. |

## The JavaScript sandbox

`action.code.execute` runs a JavaScript function expression:

```js
function(note) {
  // note.title and note.content are read-only strings
  return note.title.toUpperCase();
}
```

The return value is converted with JavaScript `String()` semantics and truncated
at 65,536 characters plus `[truncated]`.

### Engine

The user script is not compiled to WASM. It runs unmodified inside a JavaScript
interpreter that is itself compiled to WebAssembly.

| Layer | Component |
| --- | --- |
| Java API | `WasmScriptSandbox` |
| Bindings | `io.roastedroot:quickjs4j:0.1.0` from Maven Central |
| JS engine | QuickJS-NG, compiled to `wasm32-wasi` as the Bytecode Alliance Javy plugin, AOT-compiled to JVM bytecode when quickjs4j is built |
| WASM runtime | Endive, a pure-Java runtime in the Chicory family, pulled in by quickjs4j |

The stack has no native code and no JNI, so it runs unchanged on arm64, including
the Raspberry Pi path. To upgrade the engine, bump the quickjs4j version. Never
check an opaque engine binary into the repository.

### Selection and configuration

`modulo.blueprint.sandbox` (environment variable `MODULO_BLUEPRINT_SANDBOX`)
selects the in-process engine. The only accepted value is `wasm`, which is the
default in `application.properties` and the development compose file. Any other value fails startup, so a typo can never silently pick a
different isolation engine.

The selected engine is wrapped in `RemoteScriptSandbox`:

- If an EXTERNAL plugin named `script-sandbox` is attached and `ACTIVE`, scripts
  run in that workload through the plugin's `script.execute` operation. The pod is
  then the outer isolation boundary. See
  [Deploying external plugins](../features/plugins.md#deploying-external-plugins).
- If no such plugin is attached, the pod is unhealthy, or a transport error occurs,
  execution falls back to the in-process engine.
- A script failure reported by the remote engine (`SCRIPT_ERROR`) is a real
  result. It is rethrown and not retried locally.

On the Pi and other minimal deployments no plugin ever attaches, and the wrapper
simply passes calls through.

### Isolation

- **Deny by default.** The WASM instance links only the runtime's own WASI shims
  for stdout and stderr capture. There is no `java` or `Packages`, no `fetch` or
  `XMLHttpRequest`, and no filesystem.
- **Fresh world per execution.** Each call gets a new engine and runner with fresh
  linear memory, and nothing is pooled. Prototype pollution or leaked globals
  cannot survive into the next run.
- **Result channel.** The wrapper prints the result on stdout behind a random
  marker generated per execution, so `console.log` output cannot be mistaken for
  the result.

### Limits

| Concern | Limit |
| --- | --- |
| CPU | The wall-clock budget. The engine is AOT-compiled, so it has no per-instruction hook for fuel counting. |
| Wall clock | 2 s. The engine thread is interrupted with `Future.cancel(true)`, and the AOT code checks for interruption at loop back-edges. |
| Memory | Hard cap of 512 pages (32 MiB) of linear memory. QuickJS's own guards, such as "string too long", usually trip first. |
| Output | 65,536 characters, plus `[truncated]` |

Every limit breach, syntax error, and runtime error raises
`ScriptExecutionException`. The interpreter turns it into a failed step with
`SCRIPT_FAILURE`.

Do not add fuel counting to the AOT module. AOT execution is what makes creating
a fresh instance for every call cheap. If the 2 s ceiling ever matters, lower the
timeout instead.

### Calibration

Measured with JDK 21 on an x86_64 container:

| Workload | Time |
| --- | --- |
| Engine instantiation plus a trivial script | about 15 ms |
| 20,000-iteration string-append loop | about 230 ms |
| Memory balloon (string doubling) | aborted safely at about 100 ms |
| Infinite `while (true) {}` | aborted at about 2.04 s (timeout) |

## Behaviour differences from the legacy engine

`action.code.execute` used to run on Rhino. Rhino has been removed, together with
its Maven dependency and the `rhino` configuration value. The differences below
are intentional. They are recorded so that scripts and logs written before the
cutover can be understood. `ScriptSandboxContractTest` asserts the behaviour every
implementation must share; anything listed here is outside that contract.

### Language

| Script | Legacy (Rhino) | Current (QuickJS) | Migration |
| --- | --- | --- | --- |
| `parseInt('08')` | `NaN` (pre-ES5 octal leniency) | `8` (ES5 and later) | Pass an explicit radix, such as `parseInt('08', 10)`. It behaves the same on both engines. |
| Destructuring, shorthand properties, spread, optional chaining | Syntax error | Works (ES2020) | None. Scripts that failed before now run. |

QuickJS is ES2020-compliant, while Rhino 1.7.15 predated parts of ES2015 and later.
Drift in this direction only makes previously broken scripts work.

### Resource limits

| Scenario | Legacy (Rhino) | Current (QuickJS) |
| --- | --- | --- |
| `while (true) {}` | Aborted by a 500,000-instruction limit, typically in under 100 ms | Aborted by the 2 s wall clock |
| Deep recursion | Bounded at 1,000 interpreter frames | Bounded by QuickJS's stack guard (`InternalError: stack overflow`) |
| Memory balloon | No hard cap; bounded only indirectly by the instruction limit | 32 MiB linear-memory cap |

The worst-case CPU a hostile script can consume rises from about 100 ms to 2 s per
execution. Typical scripts are unaffected.

### Findings from the contract suite

- **Rhino recursion OOM.** `function f(n){return f(n)}` exhausted the JVM heap after
  about two minutes, because Rhino allocated interpreter frames on the heap and had
  no stack-depth guard. The legacy engine gained a guard before it was removed.
- **quickjs4j timeout leak.** The runner's `withTimeoutMs` gives up on the caller
  but leaves the guest thread spinning. `WasmScriptSandbox` therefore enforces the
  deadline itself by interrupting the engine thread.

# ADR 0003: `action.wasm.execute` module contract, ABI, and trust model

- **Status:** Accepted
- **Context:** [#402](https://github.com/Ikey168/Modulo/issues/402) (P1), part
  of the WASM sandbox milestone
  [#396](https://github.com/Ikey168/Modulo/issues/396); consumed by the
  backend node ([#403](https://github.com/Ikey168/Modulo/issues/403)), the
  editor UI ([#404](https://github.com/Ikey168/Modulo/issues/404)), and the
  author docs ([#405](https://github.com/Ikey168/Modulo/issues/405)).
- **Decision drivers:** every mainstream toolchain must be able to target the
  contract *today*; validation must be mechanical; the node must be no more
  privileged than `action.code.execute`; nothing here may constrain the
  external-plugin tier (#388), which solves a different problem (long-running
  services) with a different tool (gRPC workloads).

## Context

Phase 1 of #396 replaced the script engine under `action.code.execute` with a
WASM runtime while keeping JavaScript as the only authoring language. The
payoff phase is a second node type, `action.wasm.execute`, that accepts a
compiled WebAssembly module directly, so blueprint nodes can be written in
Rust, AssemblyScript, Go/TinyGo, or anything else that emits core WASM.

This ADR fixes the module contract before any code: the ABI a module must
export, the data envelope, what a module may import (nothing), how the binary
reaches the backend, and what we trust it with.

## Decision

### ABI: raw core WASM, no component model

A module must export exactly:

| Export | Signature | Purpose |
|--------|-----------|---------|
| `memory` | linear memory | shared address space for I/O |
| `alloc` | `(i32 size) -> i32 ptr` | host asks the module for a buffer to write the input into |
| `execute` | `(i32 in_ptr, i32 in_len) -> i64` | runs the node; returns the result location |

The `execute` return value packs the result buffer as
`(ptr << 32) | len` — an `i64` whose high 32 bits are the pointer to the
result bytes in the module's memory and low 32 bits the byte length. The host
copies the result out and then discards the whole instance, so modules never
need `dealloc`; leaked guest memory dies with the instance.

The **component model** is rejected for v1: toolchain support is still uneven,
the Java runtimes execute core modules today, and our envelope is small enough
that hand-rolled pointer/length passing is not a burden. Revisit when
`wasm32-wasip2` is the default target of the toolchains we care about; a
component-model contract would arrive as new export names, not a mutation of
this one.

### Envelope: versioned JSON in, raw UTF-8 out

- **Input** (host → `execute`): UTF-8 JSON,
  `{"v": 1, "note": {"title": string, "content": string}}`.
  Evolution is additive-only: new fields may appear; `v` is bumped only for a
  breaking change, which in practice means a new export name (`execute_v2`) so
  old modules keep working unchanged — the same discipline as the gRPC plugin
  contract (#390).
- **Output** (`execute` → host): raw UTF-8 text, emitted verbatim on the
  node's `output` pin, truncated at the sandbox's 64 KiB output cap. Not JSON:
  the common case is a transformed string, and structured multi-pin output can
  ride a future `execute_v2` without taxing every v1 author with JSON
  encoding.

### Imports: none, mechanically enforced

A module that declares **any** import — WASI included — is rejected at
validation time with an error naming the offending import. `action.wasm.execute`
is pure compute over the envelope, exactly as privileged as
`action.code.execute` and no more: no network, no filesystem, no clock, no
host callbacks. This is a validation rule, not a runtime stub: a module
needing `wasi_snapshot_preview1.fd_write` fails at save, not mysteriously at
execution. (Toolchain note for #405: AssemblyScript needs `--use abort=` to
drop its `env.abort` import; Rust `wasm32-unknown-unknown` with
`panic = "abort"` is import-free by default.)

### Resource limits: the Phase 1 regime, plus a declared-memory rule

At validation: the module's declared memory maximum must be ≤ **512 pages
(32 MiB)** — the same cap the JS sandbox enforces — and modules declaring no
maximum are rejected. This turns the memory bound into a static property of
the artifact instead of a runtime clamp. At execution: fresh instance per run,
2 s wall-clock budget, 64 KiB output cap — identical to `ScriptSandbox`.
User modules run through the standard Chicory **interpreter** (not AOT):
these are untrusted third-party binaries, and interpretation keeps execution
abortable; the ~ms-scale slowdown is irrelevant under a 2 s budget.

### Delivery: inline base64 in node config, 512 KiB cap

v1 stores the module as base64 in the blueprint node's `config.module` field,
alongside `config.moduleName` (display) — the blueprint IR already travels as
JSON and persists in JSONB, so the module rides the existing save/load path
with zero new storage machinery. The binary cap is **512 KiB** (≈700 KB
base64), enforced at validation; real transforms from AssemblyScript or
`no_std` Rust land far below it. The backend records the module's SHA-256 and
the editor displays it, so what runs is auditable. Content-addressed artifact
storage (upload once, reference by digest — the posture of #395) is the
designated v2 delivery path once someone actually hits the cap; it changes
`config`, not the ABI.

### Trust model and authorization

A module is **untrusted by construction** — same stance as user JS. The
sandbox limits are the enforcement; per-user capability gating is the
authorization: a new `wasm:execute` capability in
`BlueprintCapabilityService.NODE_CAPABILITY_MAP`, granted and checked exactly
like `code:execute`. No signature or provenance checks in v1: the module runs
with zero privileges, so the blast radius of a malicious upload is bounded by
the same walls that bound a malicious script; signing becomes worthwhile at
the marketplace boundary (#395), not here.

## Alternatives considered

- **Component model / WIT** — cleanest long-term interface typing; rejected
  for v1 on toolchain maturity (see above).
- **WASI with a virtualized world** (stdin/stdout envelope, like the Javy
  plugin uses internally) — works, but drags in a WASI implementation surface
  we would then have to keep locked down forever; the direct-memory ABI has a
  smaller trusted surface and is what compiled-language authors expect.
- **JS-engine-style stdout marker channel** — what the Phase 1 JS sandbox
  does; pointless indirection when we control the ABI of a compiled module.
- **Artifact upload storage in v1** — deferred: inline base64 ships with no
  new storage/GC machinery, and the cap is generous for the node sizes that
  exist today.
- **Reusing the Endive runtime** (quickjs4j's transitive dependency) for user
  modules — rejected in favor of the canonical, documented
  `com.dylibso.chicory` artifacts; the two coexist without conflict, and the
  JS engine's runtime choice remains quickjs4j's implementation detail.

## Consequences

- An example module is a page of code in any toolchain (#405 ships Rust and
  AssemblyScript references; their build outputs double as the contract's
  conformance fixtures in CI).
- Validation is fully mechanical (magic bytes → parse → imports empty →
  exports present → memory max ≤ 512 pages → size ≤ 512 KiB), so the editor
  can surface precise, actionable rejections (#404).
- The interpreter executes modules abortably; if per-fuel CPU metering ever
  becomes available in the runtime, it slots into the same seam without
  touching the ABI.
- The 512 KiB inline cap is the first thing a real Go/TinyGo module will hit;
  the designated relief valve (content-addressed artifacts) is recorded above
  so nobody "temporarily" raises the cap instead.

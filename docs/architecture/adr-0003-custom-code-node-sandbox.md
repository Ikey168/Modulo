# ADR 0003: Isolation model for the custom-code blueprint node

- **Status:** Accepted (implementation shipped; residual hardening tracked below)
- **Context:** [#279](https://github.com/Ikey168/Modulo/issues/279) — "sandboxed
  custom-code node (security spike first)", part of the Modular Plugin System
  milestone (Phase 3).
- **Decision drivers:** never ship arbitrary code execution without isolation;
  keep the dependency footprint small on the standard JDK 17 baseline; preserve
  a plain-JavaScript authoring experience; integrate with the existing blueprint
  capability/permission model.

## Context

The blueprint system supports declarative action nodes
(`action.note.create`, `action.tag.add`, `action.note.anchor`,
`action.ai.summarize`). Issue #279 asks for an `action.code.execute` node that
runs user-supplied logic beyond the declarative set — but explicitly *"start
with a security spike; do not ship arbitrary code execution without
isolation."*

A custom-code node is the highest-risk item in the plugin milestone: it runs
attacker-influenced code inside the backend JVM. The spike had to choose an
isolation mechanism, define the threat model, and confirm the node cannot
exceed its granted capabilities or exhaust host resources before anything
relied on it.

### Options considered

**Option A — GraalVM polyglot sandbox.** Best-in-class isolation with
first-class resource limits (CPU time, heap, statement count) via the
`Context.Builder` sandbox policy. Rejected for now: requires either the GraalVM
JDK or pulling the full Truffle framework (~100 MB of artifacts) into a build
that targets a stock JDK 17. Disproportionate to a single optional node.

**Option B — WASM runtime (Chicory / wasmtime-java).** Excellent
process/memory isolation by construction. Rejected: forces authors to compile
scripts to WASM, which destroys the "write a small JS function" authoring
experience the node is meant to provide.

**Option C — Mozilla Rhino, interpreted mode (chosen).** Pure-Java JS
interpreter, ships as a single ~1 MB JAR (`org.mozilla:rhino:1.7.15`), runs on
stock JDK 17. Provides the sandboxing primitives we need: a safe global scope
with no Java bridge, and an instruction-count observer for CPU/wall-clock
bounding.

## Decision

Adopt **Option C (Rhino, interpreted)** for `action.code.execute`. The
implementation lives in
[`SandboxedScriptService`](../../backend/src/main/java/com/modulo/blueprint/sandbox/SandboxedScriptService.java)
and is exercised by `SandboxedScriptServiceTest`.

### Isolation controls in place

| Threat | Control |
|--------|---------|
| Host Java access (`java.*`, `Packages`, `JavaAdapter`, `JavaImporter`) | `Context.initSafeStandardObjects()` — these are absent from the global scope |
| Ambient I/O (network, file, fetch/XHR) | Nothing exposed beyond a read-only `note` binding (`title`/`content` as plain strings); the `Note` entity itself is never passed in, so no save/delete reachable |
| CPU exhaustion / infinite loops | Interpreted mode (optimization level `-1`) + `observeInstructionCount`; aborts past `MAX_INSTRUCTIONS` (500k) |
| Wall-clock abuse | Same observer checks elapsed time, aborts past `WALL_TIMEOUT_MS` (2s) |
| Scope bleed between runs | Fresh `Context` + scope per `execute()`; verified by `multipleSequentialCallsAreIsolated` |
| Oversized return value | Output truncated at `MAX_OUTPUT_CHARS` (64k) |

### Capability gating

The node carries the `code:execute` capability (frontend `nodeCatalog.ts` /
`capabilities.ts`; backend `BlueprintCapabilityService.NODE_CAPABILITY_MAP`).
The interpreter enforces the grant **before** invoking the sandbox: if
`code:execute` is not granted for the blueprint, the node is skipped via the
`then` pin and never reaches `SandboxedScriptService`. This satisfies the
"cannot exceed its granted capabilities" half of the acceptance criteria.

## Consequences

- A custom-code node ships, gated behind an explicit, user-granted capability,
  with no Java bridge and bounded CPU/wall time under normal (bytecode-paced)
  execution.
- Rhino's interpreted mode is mandatory for instruction counting — the node
  cannot be JIT-compiled. Acceptable: these scripts are short transforms, not
  hot paths.

### Residual risks (accepted for now; hardening recommended)

The spike surfaced three resource-exhaustion paths the current limits do **not**
fully close. They share one root cause: the instruction/wall-clock observer only
fires *between* interpreted bytecode instructions, so any single long-running
**native** operation bypasses it.

1. **Memory bomb via one native allocation.** `'x'.repeat(1e9)` (or a large
   `Array(n)`) allocates hundreds of MB in a single instruction-cheap call.
   Instruction counting never trips, and `MAX_OUTPUT_CHARS` only bounds the
   *returned* value, not intermediates. There is no heap cap.
2. **Timeout evasion by native calls (ReDoS).** Catastrophic regex backtracking
   or a huge `repeat` runs entirely inside one native call. The observer is
   never reached, so neither the instruction limit nor the 2s wall timeout
   fires — execution runs synchronously on the caller thread with no watchdog
   able to interrupt it.
3. **`StackOverflowError` not caught.** Deep recursion exhausts the Java stack
   (Rhino's `setMaximumInterpreterStackDepth` is not configured). The result is
   a `StackOverflowError`, which is an `Error` — the `catch` clauses handle only
   `ScriptExecutionException` and `RhinoException`, so it propagates past the
   sandbox.

**Recommended hardening (follow-up issue):**
- Run `execute()` on a dedicated thread with a hard wall-clock deadline and
  `Thread.interrupt()` / forced termination, so timeouts no longer depend on the
  cooperative observer.
- Set `Context.setMaximumInterpreterStackDepth(...)` and broaden the catch to
  include `StackOverflowError` (and `Error` defensively), mapping to
  `ScriptExecutionException`.
- Guard against single-call memory bombs: cap or wrap `String.prototype.repeat`
  and large array construction, or run under a `-Xss`/heap-limited worker.

Until those land, treat `code:execute` as a **trusted-author** capability: grant
it only to blueprints whose code has been reviewed, not to untrusted
marketplace submissions. If untrusted custom code becomes a requirement,
re-evaluate Option A (GraalVM sandbox), which closes risks 1–3 natively, and
supersede this ADR.

# ADR 0003: Isolation model for the custom-code blueprint node

- **Status:** Accepted (implementation shipped; hardening applied — see below)
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

### Resource-exhaustion analysis and hardening

The cooperative instruction/wall-clock observer only fires *between* interpreted
bytecode instructions. The spike asked: which exhaustion paths bypass it, and
are they bounded? Three were examined; the implementation was hardened in
response.

1. **Deep recursion → `StackOverflowError` (closed).** Previously unbounded
   recursion exhausted the Java stack and raised a `StackOverflowError` — an
   `Error` the `catch` clauses did not handle, so it propagated past the sandbox.
   *Hardening:* `Context.setMaximumInterpreterStackDepth(MAX_STACK_DEPTH)` now
   makes recursion raise a catchable Rhino error, with `StackOverflowError`
   caught defensively as a backstop. Both map to `ScriptExecutionException`.
   Test: `deepRecursionIsAbortedByStackDepthLimit`.

2. **Non-yielding native CPU (bounded).** A long native call cannot be
   interrupted by the cooperative observer. *Hardening:* the script now runs on
   a dedicated **daemon worker thread** bounded by a hard wall-clock deadline
   (`WALL_TIMEOUT_MS + HARD_DEADLINE_GRACE_MS`); on expiry the caller is
   unblocked with a timeout error and the thread is interrupted and abandoned.
   **Finding:** the obvious example — catastrophic regex backtracking — turned
   out *not* to bypass the observer: Rhino counts backtracking against the
   instruction limit, so it trips `MAX_INSTRUCTIONS` first. The hard deadline
   remains the backstop for any genuinely non-counted native spin.
   Test: `catastrophicRegexIsBoundedQuickly`.

3. **Single-call memory allocation (mitigated, not eliminated).**
   `'x'.repeat(2147483647)` or a large `Array(n)` allocates in one native call
   that the observer never sees; `MAX_OUTPUT_CHARS` only bounds the *returned*
   value, not intermediates. *Hardening:* `OutOfMemoryError` from such an
   allocation is now caught on the worker thread and surfaced as a bounded
   `ScriptExecutionException` ("memory limit exceeded"), so a runaway allocation
   cannot crash the caller. Test: `singleCallAllocationBombIsCaught`.

### Remaining limitations (accepted)

- **No hard heap cap.** Catching `OutOfMemoryError` protects the *caller*, but a
  script that allocates aggressively still strains the shared JVM heap before
  the allocation fails. True per-execution memory isolation is not achievable
  in-process with Rhino.
- **Abandoned threads.** A script stuck in a non-interruptible native call keeps
  running on its daemon thread after the deadline unblocks the caller; it ties
  up a thread/core until the native operation finishes. Per-call daemon threads
  avoid pool exhaustion but allow thread accumulation under sustained abuse.

Both are closed only by out-of-process or GraalVM-sandbox isolation. Until then,
treat `code:execute` as a **trusted-author** capability: grant it to blueprints
whose code has been reviewed, not to untrusted marketplace submissions. If
untrusted custom code becomes a requirement, re-evaluate Option A (GraalVM
sandbox) — which closes the remaining limitations natively — and supersede this
ADR.

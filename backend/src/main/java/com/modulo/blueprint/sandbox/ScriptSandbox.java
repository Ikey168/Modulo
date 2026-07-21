package com.modulo.blueprint.sandbox;

/**
 * Sandboxed execution of user-supplied scripts for action.code.execute (#397).
 *
 * The single seam between the blueprint interpreter and whichever isolation
 * engine is configured. Implementations are selected by the
 * {@code modulo.blueprint.sandbox} property (see {@link ScriptSandboxConfig}):
 *
 *   - {@code rhino} — {@link RhinoScriptSandbox}, the original pure-Java engine (#279)
 *   - {@code wasm}  — {@link WasmScriptSandbox}, QuickJS compiled to WebAssembly (#398)
 *
 * Contract (frozen — existing blueprints depend on it):
 *   {@code code} is a JS function expression accepting a note object with
 *   read-only {@code title} and {@code content} strings. The return value is
 *   coerced to a string (JS ToString semantics) and returned; output larger
 *   than {@link #MAX_OUTPUT_CHARS} is truncated with a {@code [truncated]}
 *   marker. Scripts that exceed resource limits or fail to parse/execute
 *   throw {@link ScriptExecutionException}.
 *
 * This interface is also the seam the external-plugin sandbox extraction
 * (#393) wraps for remote routing — keep it engine- and transport-agnostic.
 */
public interface ScriptSandbox {

    /** Wall-clock budget shared by all implementations. */
    long WALL_TIMEOUT_MS = 2_000;

    /** Result-size cap shared by all implementations. */
    int MAX_OUTPUT_CHARS = 65_536;

    /**
     * Execute {@code code} (a JS function expression) against the given note
     * fields and return the string result.
     *
     * @throws ScriptExecutionException if the script exceeds a resource limit
     *         or has a syntax / runtime error
     */
    String execute(String code, String noteTitle, String noteContent);

    /** Thrown when a script violates a resource limit or has a syntax / runtime error. */
    class ScriptExecutionException extends RuntimeException {
        public ScriptExecutionException(String message) { super(message); }
        public ScriptExecutionException(String message, Throwable cause) { super(message, cause); }
    }
}

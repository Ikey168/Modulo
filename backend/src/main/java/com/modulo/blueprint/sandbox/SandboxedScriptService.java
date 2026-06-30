package com.modulo.blueprint.sandbox;

import org.mozilla.javascript.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Sandboxed JavaScript execution for action.code.execute (#279).
 *
 * Isolation model decision + threat model + residual-risk register:
 *   docs/architecture/adr-0003-custom-code-node-sandbox.md
 *
 * Isolation model — security spike decision:
 *
 *   GraalVM Polyglot Sandbox: best-in-class isolation and resource limits, but requires
 *   the GraalVM JDK or pulling in the full Truffle framework as a Maven artifact (~100 MB).
 *   Overkill given our standard JDK 17 baseline.
 *
 *   WASM runtime (Chicory / wasmtime-java): excellent process-level isolation, but forces
 *   users to compile their scripts to WASM — poor authoring experience.
 *
 *   Rhino (chosen): pure-Java interpreter, ships as a single ~1 MB JAR, and has built-in
 *   sandboxing primitives that are sufficient for our threat model:
 *
 * Threat model:
 *   - Host Java access: initSafeStandardObjects() removes Packages, java.*, JavaAdapter,
 *     and JavaImporter from the global scope. No ClassShutter is needed for JS-only code.
 *   - Infinite loops / CPU exhaustion: interpreted mode (optimization level -1) enables
 *     instruction counting. The factory's observeInstructionCount throws after MAX_INSTRUCTIONS.
 *   - Wall-clock abuse (timed waits via busy-spin): the same observer checks elapsed wall
 *     time and throws if WALL_TIMEOUT_MS is exceeded.
 *   - I/O: no fetch, XHR, or file APIs are exposed — only the `note` binding (title/content
 *     as plain strings). The original Note entity is not passed in, preventing save/delete.
 *   - Memory: no hard heap cap, but the instruction limit bounds allocations to a safe range.
 *   - Output size: capped at MAX_OUTPUT_CHARS to prevent heap growth from huge return values.
 *
 * User-facing script contract:
 *   The config.code field must be a JS function expression that accepts a note object:
 *
 *     function(note) {
 *       // note.title: string, note.content: string (read-only)
 *       return note.title.toUpperCase();
 *     }
 *
 *   The return value is coerced to a string and emitted on the 'output' pin.
 */
@Service
public class SandboxedScriptService {

    private static final Logger logger = LoggerFactory.getLogger(SandboxedScriptService.class);

    static final int MAX_INSTRUCTIONS = 500_000;
    static final long WALL_TIMEOUT_MS = 2_000;
    static final int MAX_OUTPUT_CHARS = 65_536;
    private static final int OBSERVER_THRESHOLD = 10_000;

    /**
     * Execute {@code code} (a JS function expression) in an isolated Rhino context.
     * Injects {@code noteTitle} and {@code noteContent} as {@code note.title} /
     * {@code note.content} in the global scope. Returns the string result of calling
     * the function with {@code note}.
     *
     * @throws ScriptExecutionException if the script exceeds resource limits or has a syntax/runtime error
     */
    public String execute(String code, String noteTitle, String noteContent) {
        long[] startMs = {System.currentTimeMillis()};
        int[] instructionsSeen = {0};

        ContextFactory factory = new ContextFactory() {
            @Override
            protected void observeInstructionCount(Context cx, int count) {
                instructionsSeen[0] += count;
                if (instructionsSeen[0] > MAX_INSTRUCTIONS) {
                    throw new ScriptExecutionException("Script instruction limit exceeded");
                }
                if (System.currentTimeMillis() - startMs[0] > WALL_TIMEOUT_MS) {
                    throw new ScriptExecutionException("Script wall-clock timeout exceeded");
                }
            }
        };

        Context cx = factory.enterContext();
        try {
            cx.setOptimizationLevel(-1); // interpreted mode — required for instruction counting
            cx.setInstructionObserverThreshold(OBSERVER_THRESHOLD);

            ScriptableObject scope = cx.initSafeStandardObjects(); // no java.*, Packages, etc.

            Scriptable noteObj = cx.newObject(scope);
            ScriptableObject.putProperty(noteObj, "title", noteTitle != null ? noteTitle : "");
            ScriptableObject.putProperty(noteObj, "content", noteContent != null ? noteContent : "");
            ScriptableObject.putProperty(scope, "note", noteObj);

            // Wrap the user's function expression and call it immediately with note.
            String script = "(" + code + ")(note)";
            Object result = cx.evaluateString(scope, script, "<custom-code>", 1, null);

            String output = Context.toString(result);
            if (output != null && output.length() > MAX_OUTPUT_CHARS) {
                logger.warn("action.code.execute: output truncated ({} chars)", output.length());
                output = output.substring(0, MAX_OUTPUT_CHARS) + "[truncated]";
            }
            return output != null ? output : "";

        } catch (ScriptExecutionException e) {
            throw e;
        } catch (RhinoException e) {
            throw new ScriptExecutionException("Script error: " + e.getMessage(), e);
        } finally {
            Context.exit();
        }
    }

    /** Thrown when the script violates a resource limit or has a syntax / runtime error. */
    public static class ScriptExecutionException extends RuntimeException {
        public ScriptExecutionException(String message) { super(message); }
        public ScriptExecutionException(String message, Throwable cause) { super(message, cause); }
    }
}

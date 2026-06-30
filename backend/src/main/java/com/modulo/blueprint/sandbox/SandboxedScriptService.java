package com.modulo.blueprint.sandbox;

import org.mozilla.javascript.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;

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
 *   - Wall-clock abuse (bytecode-paced): the same observer checks elapsed wall time and
 *     throws if WALL_TIMEOUT_MS is exceeded.
 *   - Wall-clock abuse (non-yielding native calls — e.g. catastrophic regex backtracking):
 *     the observer only fires between interpreted instructions, so a single long native call
 *     can evade it. The script therefore runs on a dedicated daemon worker thread bounded by
 *     a HARD wall-clock deadline (WALL_TIMEOUT_MS + grace); on expiry the caller is unblocked
 *     with a timeout error and the runaway thread is interrupted and abandoned.
 *   - Deep recursion: setMaximumInterpreterStackDepth caps JS call depth so recursion raises a
 *     catchable Rhino error instead of a JVM StackOverflowError. StackOverflowError is also
 *     caught defensively.
 *   - Memory: no hard heap cap (not achievable in-process with Rhino). The instruction limit
 *     and hard deadline bound most allocations; OutOfMemoryError from a runaway single-call
 *     allocation is caught so it cannot crash the caller. Full memory isolation requires
 *     GraalVM / a separate process — see ADR-0003.
 *   - I/O: no fetch, XHR, or file APIs are exposed — only the `note` binding (title/content
 *     as plain strings). The original Note entity is not passed in, preventing save/delete.
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
    static final int MAX_STACK_DEPTH = 1_000;
    private static final int OBSERVER_THRESHOLD = 10_000;

    /**
     * Extra time beyond the cooperative {@link #WALL_TIMEOUT_MS} that the caller waits before
     * giving up on a script stuck in a non-yielding native call. The cooperative observer
     * should normally fire first; this is the hard backstop for native-call evasion (ReDoS).
     */
    static final long HARD_DEADLINE_GRACE_MS = 1_000;

    private final AtomicLong threadCounter = new AtomicLong();

    /**
     * Execute {@code code} (a JS function expression) in an isolated Rhino context running on a
     * dedicated daemon thread bounded by a hard wall-clock deadline. Injects {@code noteTitle}
     * and {@code noteContent} as {@code note.title} / {@code note.content} in the global scope.
     * Returns the string result of calling the function with {@code note}.
     *
     * @throws ScriptExecutionException if the script exceeds resource limits or has a syntax/runtime error
     */
    public String execute(String code, String noteTitle, String noteContent) {
        FutureTask<String> task = new FutureTask<>(() -> runInContext(code, noteTitle, noteContent));
        Thread worker = new Thread(task, "sandbox-script-" + threadCounter.incrementAndGet());
        worker.setDaemon(true);
        worker.start();

        try {
            return task.get(WALL_TIMEOUT_MS + HARD_DEADLINE_GRACE_MS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            // The script is stuck in a non-yielding native call that the cooperative observer
            // could not interrupt. Unblock the caller; interrupt and abandon the daemon thread.
            worker.interrupt();
            task.cancel(true);
            logger.warn("action.code.execute: hard wall-clock deadline exceeded; abandoning script thread '{}'",
                worker.getName());
            throw new ScriptExecutionException("Script wall-clock timeout exceeded");
        } catch (InterruptedException e) {
            worker.interrupt();
            task.cancel(true);
            Thread.currentThread().interrupt();
            throw new ScriptExecutionException("Script execution interrupted");
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof ScriptExecutionException) {
                throw (ScriptExecutionException) cause;
            }
            throw new ScriptExecutionException(
                "Script error: " + (cause != null ? cause.getMessage() : e.getMessage()),
                cause != null ? cause : e);
        }
    }

    /** Runs the script in a fresh, isolated Rhino context on the calling (worker) thread. */
    private String runInContext(String code, String noteTitle, String noteContent) {
        final long startMs = System.currentTimeMillis();
        final int[] instructionsSeen = {0};

        ContextFactory factory = new ContextFactory() {
            @Override
            protected void observeInstructionCount(Context cx, int count) {
                instructionsSeen[0] += count;
                if (instructionsSeen[0] > MAX_INSTRUCTIONS) {
                    throw new ScriptExecutionException("Script instruction limit exceeded");
                }
                if (System.currentTimeMillis() - startMs > WALL_TIMEOUT_MS) {
                    throw new ScriptExecutionException("Script wall-clock timeout exceeded");
                }
                if (Thread.currentThread().isInterrupted()) {
                    throw new ScriptExecutionException("Script execution interrupted");
                }
            }
        };

        Context cx = factory.enterContext();
        try {
            cx.setOptimizationLevel(-1); // interpreted mode — required for instruction counting + stack-depth cap
            cx.setInstructionObserverThreshold(OBSERVER_THRESHOLD);
            cx.setMaximumInterpreterStackDepth(MAX_STACK_DEPTH); // bound recursion (interpreted mode only)

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
        } catch (StackOverflowError e) {
            // Backstop: deep recursion below the interpreter cap, or native-stack growth.
            throw new ScriptExecutionException("Script stack depth exceeded");
        } catch (OutOfMemoryError e) {
            // A runaway single-call allocation. The failed allocation is unwound here so it
            // cannot crash the caller; full memory isolation would require GraalVM/process (ADR-0003).
            logger.warn("action.code.execute: script aborted on OutOfMemoryError");
            throw new ScriptExecutionException("Script memory limit exceeded");
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

package com.modulo.blueprint.sandbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.roastedroot.quickjs4j.core.Engine;
import io.roastedroot.quickjs4j.core.GuestException;
import io.roastedroot.quickjs4j.core.Runner;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import run.endive.runtime.ByteBufferMemory;
import run.endive.wasm.types.MemoryLimits;

/**
 * WebAssembly implementation of {@link ScriptSandbox} (#398, #399): the user's
 * JavaScript runs unmodified inside a QuickJS interpreter that is itself
 * compiled to WASM, executed by a pure-Java runtime. Same authoring contract
 * as Rhino, categorically stronger walls.
 *
 * Engine provenance:
 *   io.roastedroot:quickjs4j (Maven Central) — the Bytecode Alliance Javy
 *   QuickJS plugin (QuickJS-NG compiled to wasm32-wasi via Javy), AOT-compiled
 *   to JVM bytecode by the Endive (Chicory-family) compiler and executed by
 *   the pure-Java Endive runtime. No native code, no JNI — works on the
 *   standard JDK 17 baseline and on arm64 (Pi path, #386) unchanged.
 *   See docs/blueprint/wasm-sandbox.md for the full provenance chain.
 *
 * Isolation model:
 *   - Deny-by-default: the WASM instance is linked with no host imports beyond
 *     the runtime's own WASI shims (stdout/stderr capture); there is no
 *     Packages/java.*, no fetch/XHR, no filesystem. Host access isn't stripped
 *     — it never exists.
 *   - Memory: linear memory is hard-capped at {@link #MAX_MEMORY_PAGES} WASM
 *     pages via the runtime's memory factory — the hard heap bound the Rhino
 *     engine could not provide. QuickJS's own internal guards (e.g. "string
 *     too long") typically trip first; the page cap is the outer wall.
 *   - CPU / wall clock: {@link ScriptSandbox#WALL_TIMEOUT_MS} enforced by
 *     interrupting the engine thread (see SCRIPT_EXECUTOR). Deviation from
 *     Rhino (#399): the module is AOT-compiled, so per-instruction fuel
 *     metering is not available — the wall-clock budget is the CPU bound.
 *     Calibration (docs/blueprint/wasm-sandbox.md): a simple transform
 *     completes in ~15 ms, a 20k-iteration string loop in ~230 ms; 2s
 *     corresponds to far more work than Rhino's 500k-instruction budget allowed.
 *   - Isolation between runs: a fresh Engine + Runner (fresh linear memory)
 *     per execution; nothing is shared or pooled.
 *   - Output size: capped at MAX_OUTPUT_CHARS, as with Rhino.
 *
 * Result channel: the wrapper script prints the ToString-coerced result on
 * stdout behind a per-execution random marker, so user console.log noise
 * cannot be confused with the result.
 */
public class WasmScriptSandbox implements ScriptSandbox {

    private static final Logger logger = LoggerFactory.getLogger(WasmScriptSandbox.class);

    /** Hard cap on guest linear memory: 512 × 64 KiB pages = 32 MiB. */
    static final int MAX_MEMORY_PAGES = 512;

    private static final ObjectMapper JSON = new ObjectMapper();

    private static final AtomicInteger THREAD_SEQ = new AtomicInteger();

    /**
     * Wall-clock enforcement must end in a thread interrupt: the runner's own
     * timeout only abandons the caller and leaves the guest thread spinning
     * (verified against quickjs4j 0.1.0), whereas the AOT-compiled module
     * checks interruption at loop back-edges and dies cleanly. So executions
     * run on this pool and the deadline is enforced with Future.cancel(true).
     * Daemon threads, so a guest that somehow ignored the interrupt could
     * still never block JVM shutdown.
     */
    private static final ExecutorService SCRIPT_EXECUTOR = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "wasm-sandbox-" + THREAD_SEQ.incrementAndGet());
        t.setDaemon(true);
        return t;
    });

    @Override
    public String execute(String code, String noteTitle, String noteContent) {
        String marker = "R:" + UUID.randomUUID() + ":";
        String script = buildScript(code, noteTitle, noteContent, marker);

        Future<String> run = SCRIPT_EXECUTOR.submit(() -> {
            try (Engine engine = Engine.builder()
                    .withMemoryFactory(limits -> new ByteBufferMemory(new MemoryLimits(
                        limits.initialPages(), Math.min(MAX_MEMORY_PAGES, limits.maximumPages()))))
                    .build();
                 Runner runner = Runner.builder()
                    .withEngine(engine)
                    // backstop only — the real deadline is enforced below via interrupt
                    .withTimeoutMs((int) (WALL_TIMEOUT_MS * 4))
                    .build()) {
                runner.compileAndExec(script);
                return runner.stdout();
            }
        });

        String stdout;
        try {
            stdout = run.get(WALL_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            run.cancel(true); // interrupt → guest dies at the next loop back-edge
            throw new ScriptExecutionException("Script wall-clock timeout exceeded");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            run.cancel(true);
            throw new ScriptExecutionException("Script execution interrupted", e);
        } catch (ExecutionException e) {
            throw mapEngineFailure(e.getCause() != null ? e.getCause() : e);
        }
        return extractResult(stdout, marker);
    }

    private static ScriptExecutionException mapEngineFailure(Throwable cause) {
        if (cause instanceof IllegalArgumentException) {
            // quickjs4j reports compile (syntax) failures as IllegalArgumentException
            return new ScriptExecutionException("Script error: " + firstLine(cause.getMessage()), cause);
        }
        if (cause instanceof GuestException) {
            return new ScriptExecutionException("Script error: " + guestErrorMessage((GuestException) cause), cause);
        }
        if (cause.getMessage() != null && cause.getMessage().contains("Timeout")) {
            return new ScriptExecutionException("Script wall-clock timeout exceeded", cause);
        }
        return new ScriptExecutionException("Script error: " + firstLine(cause.getMessage()), cause);
    }

    private static String buildScript(String code, String noteTitle, String noteContent, String marker) {
        try {
            return "const note = {title: " + JSON.writeValueAsString(noteTitle != null ? noteTitle : "")
                + ", content: " + JSON.writeValueAsString(noteContent != null ? noteContent : "") + "};\n"
                + "const __fn = (" + code + ");\n"
                + "const __result = __fn(note);\n"
                + "console.log(" + JSON.writeValueAsString(marker) + " + String(__result));\n";
        } catch (JsonProcessingException e) {
            throw new ScriptExecutionException("Script error: could not encode note payload", e);
        }
    }

    private String extractResult(String stdout, String marker) {
        int idx = stdout != null ? stdout.lastIndexOf(marker) : -1;
        if (idx < 0) {
            // The script ran but never reached the result line — treat as a script error.
            throw new ScriptExecutionException("Script error: no result produced");
        }
        String output = stdout.substring(idx + marker.length());
        if (output.endsWith("\n")) {
            output = output.substring(0, output.length() - 1);
        }
        if (output.length() > MAX_OUTPUT_CHARS) {
            logger.warn("action.code.execute: output truncated ({} chars)", output.length());
            output = output.substring(0, MAX_OUTPUT_CHARS) + "[truncated]";
        }
        return output;
    }

    /** The guest reports JS errors on stderr inside a runtime panic — pull out the JS message. */
    private static String guestErrorMessage(GuestException e) {
        String msg = e.getMessage() != null ? e.getMessage() : "script failed";
        int errIdx = msg.indexOf("Error: ");
        if (errIdx >= 0) {
            return firstLine(msg.substring(errIdx));
        }
        return firstLine(msg);
    }

    private static String firstLine(String s) {
        if (s == null) return "unknown error";
        int nl = s.indexOf('\n');
        return nl >= 0 ? s.substring(0, nl) : s;
    }
}

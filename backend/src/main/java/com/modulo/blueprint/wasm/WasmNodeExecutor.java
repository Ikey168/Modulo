package com.modulo.blueprint.wasm;

import com.dylibso.chicory.runtime.ExportFunction;
import com.dylibso.chicory.runtime.Instance;
import com.dylibso.chicory.wasm.WasmModule;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Executes a validated action.wasm.execute module under the sandbox limit
 * regime (#403, ADR 0003).
 *
 * The module runs through the Chicory interpreter — untrusted third-party
 * binaries stay abortable — with the limits enforced in an execution
 * listener, Rhino-style: a fuel budget bounds total instructions and the
 * wall-clock budget is checked on the same cadence, both on the executing
 * thread itself (no interrupt choreography needed, unlike the JS engine).
 *
 * Memory needs no runtime clamp: validation rejects modules whose declared
 * maximum exceeds 512 pages, so the bound is a static property of the
 * artifact. A fresh instance (fresh linear memory) runs each execution and
 * is discarded afterwards — modules never need dealloc.
 */
public final class WasmNodeExecutor {

    private static final Logger logger = LoggerFactory.getLogger(WasmNodeExecutor.class);

    /** Same regime as ScriptSandbox: 2 s wall clock, 64 KiB output. */
    public static final long WALL_TIMEOUT_MS = 2_000;
    public static final int MAX_OUTPUT_CHARS = 65_536;

    /**
     * Fuel budget for the interpreter. Compiled modules execute far more WASM
     * instructions per unit of useful work than Rhino's JS instruction count —
     * 200M interpreted instructions comfortably exceeds what any legitimate
     * note transform needs while still bounding total work independently of
     * the clock.
     */
    public static final long MAX_FUEL = 200_000_000L;

    /** Check the clock every this-many instructions (power of two, used as a mask). */
    private static final long CHECK_INTERVAL_MASK = (1 << 14) - 1;

    private static final ObjectMapper JSON = new ObjectMapper();

    private WasmNodeExecutor() {}

    /**
     * Run the module against the note envelope and return its output text.
     *
     * @throws WasmExecutionException on limit breach, trap, or ABI violation
     */
    public static String execute(WasmModule module, String noteTitle, String noteContent) {
        byte[] envelope = buildEnvelope(noteTitle, noteContent);

        long deadline = System.currentTimeMillis() + WALL_TIMEOUT_MS;
        long[] fuel = {0};

        Instance instance;
        try {
            instance = Instance.builder(module)
                .withUnsafeExecutionListener((insn, stack) -> {
                    if ((++fuel[0] & CHECK_INTERVAL_MASK) == 0) {
                        if (fuel[0] > MAX_FUEL) {
                            throw new WasmExecutionException("Module instruction limit exceeded");
                        }
                        if (System.currentTimeMillis() > deadline) {
                            throw new WasmExecutionException("Module wall-clock timeout exceeded");
                        }
                    }
                })
                .build();
        } catch (WasmExecutionException e) {
            throw e; // a hostile start section already hit a limit
        } catch (RuntimeException e) {
            throw new WasmExecutionException("Module instantiation failed: " + firstLine(e.getMessage()), e);
        }

        try {
            ExportFunction alloc = instance.export("alloc");
            int inPtr = (int) alloc.apply(envelope.length)[0];
            instance.memory().write(inPtr, envelope);

            long packed = instance.export("execute").apply(inPtr, envelope.length)[0];
            int outPtr = (int) (packed >>> 32);
            int outLen = (int) packed;
            if (outLen < 0) {
                throw new WasmExecutionException("Module returned a negative result length (ABI violation)");
            }

            String output;
            try {
                output = new String(instance.memory().readBytes(outPtr, outLen), StandardCharsets.UTF_8);
            } catch (RuntimeException e) {
                throw new WasmExecutionException("Module returned an out-of-bounds result pointer (ABI violation)", e);
            }
            if (output.length() > MAX_OUTPUT_CHARS) {
                logger.warn("action.wasm.execute: output truncated ({} chars)", output.length());
                output = output.substring(0, MAX_OUTPUT_CHARS) + "[truncated]";
            }
            return output;

        } catch (WasmExecutionException e) {
            throw e;
        } catch (RuntimeException e) {
            // Traps (unreachable, OOB, memory.grow past max) surface here.
            throw new WasmExecutionException("Module trapped: " + firstLine(e.getMessage()), e);
        }
    }

    private static byte[] buildEnvelope(String noteTitle, String noteContent) {
        ObjectNode envelope = JSON.createObjectNode();
        envelope.put("v", 1);
        ObjectNode note = envelope.putObject("note");
        note.put("title", noteTitle != null ? noteTitle : "");
        note.put("content", noteContent != null ? noteContent : "");
        return envelope.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String firstLine(String s) {
        if (s == null) return "unknown error";
        int nl = s.indexOf('\n');
        return nl >= 0 ? s.substring(0, nl) : s;
    }

    /** Thrown when a module violates a resource limit, traps, or breaks the ABI. */
    public static class WasmExecutionException extends RuntimeException {
        public WasmExecutionException(String message) { super(message); }
        public WasmExecutionException(String message, Throwable cause) { super(message, cause); }
    }
}

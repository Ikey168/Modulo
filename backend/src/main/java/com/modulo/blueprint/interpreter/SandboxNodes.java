package com.modulo.blueprint.interpreter;

import com.modulo.blueprint.sandbox.ScriptSandbox;
import com.modulo.blueprint.wasm.WasmModuleValidator;
import com.modulo.blueprint.wasm.WasmNodeExecutor;
import com.modulo.entity.Note;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Built-in sandboxed code nodes: {@code action.code.execute} and {@code action.wasm.execute}. */
final class SandboxNodes {

    private final InterpreterDependencies deps;

    private final ConcurrentHashMap<String, com.dylibso.chicory.wasm.WasmModule>
        wasmModuleCache = new ConcurrentHashMap<>();

    SandboxNodes(InterpreterDependencies deps) {
        this.deps = deps;
    }

    NodeResult executeScript(Map<String, Object> config, Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        String code = config != null ? (String) config.get("code") : null;
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("INVALID_SCRIPT_CONFIG");
        }
        Note note = (Note) inputs.get("note");
        String title   = note != null && note.getTitle()   != null ? note.getTitle()   : "";
        String content = note != null && note.getContent() != null ? note.getContent() : "";
        String output;
        try {
            output = deps.scriptSandbox().execute(code, title, content);
        } catch (ScriptSandbox.ScriptExecutionException e) {
            throw new IllegalStateException("SCRIPT_FAILURE");
        }
        outputs.put("output", output);
        return new NodeResult(outputs, "then");
    }

    NodeResult executeWasm(Map<String, Object> config, Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        String moduleB64 = config != null ? (String) config.get("module") : null;
        if (moduleB64 == null || moduleB64.isBlank()) {
            throw new IllegalArgumentException("INVALID_WASM_CONFIG");
        }
        Note wasmNote = (Note) inputs.get("note");
        String wasmTitle   = wasmNote != null && wasmNote.getTitle()   != null ? wasmNote.getTitle()   : "";
        String wasmContent = wasmNote != null && wasmNote.getContent() != null ? wasmNote.getContent() : "";
        String wasmOutput;
        try {
            wasmOutput = WasmNodeExecutor.execute(
                validatedWasmModule(moduleB64), wasmTitle, wasmContent);
        } catch (WasmModuleValidator.WasmModuleValidationException
                | WasmNodeExecutor.WasmExecutionException | IllegalArgumentException e) {
            throw new IllegalStateException("WASM_FAILURE");
        }
        outputs.put("output", wasmOutput);
        return new NodeResult(outputs, "then");
    }

    /**
     * Decode, validate, and cache an action.wasm.execute module (#403).
     * Re-validating and re-parsing on every trigger firing would dominate
     * execution time for hot blueprints, so parsed modules are cached against
     * the config's base64 string (already retained by the registered IR — the
     * key adds no new memory). Bounded crudely: registered blueprints hold a
     * handful of modules; a full cache means churn, so start over.
     */
    private com.dylibso.chicory.wasm.WasmModule validatedWasmModule(String moduleB64) {
        if (wasmModuleCache.size() > 64) {
            wasmModuleCache.clear();
        }
        return wasmModuleCache.computeIfAbsent(moduleB64,
            b64 -> WasmModuleValidator.validate(java.util.Base64.getDecoder().decode(b64)).module());
    }
}

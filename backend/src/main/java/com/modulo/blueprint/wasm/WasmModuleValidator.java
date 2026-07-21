package com.modulo.blueprint.wasm;

import com.dylibso.chicory.wasm.Parser;
import com.dylibso.chicory.wasm.WasmModule;
import com.dylibso.chicory.wasm.types.Export;
import com.dylibso.chicory.wasm.types.ExternalType;
import com.dylibso.chicory.wasm.types.FunctionType;
import com.dylibso.chicory.wasm.types.ValType;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Save-time validation of user-supplied action.wasm.execute modules (#403).
 *
 * Every rule of ADR 0003 is checked mechanically, in a fixed order, and each
 * rejection names the rule that failed so the editor (#404) can surface an
 * actionable message. Validation happens at blueprint save/registration, not
 * first execution: a bad module must fail while the author is looking.
 *
 * Rules (in order): SIZE → PARSE → IMPORTS → EXPORTS → MEMORY_MAX.
 */
public final class WasmModuleValidator {

    /** ADR 0003: inline module cap, 512 KiB of raw bytes. */
    public static final int MAX_MODULE_BYTES = 512 * 1024;

    /** ADR 0003: declared linear-memory maximum must be ≤ 512 pages (32 MiB). */
    public static final int MAX_MEMORY_PAGES = 512;

    private WasmModuleValidator() {}

    /** A module that passed every rule, with its parse result and content hash. */
    public static final class ValidatedModule {
        private final WasmModule module;
        private final String sha256;

        ValidatedModule(WasmModule module, String sha256) {
            this.module = module;
            this.sha256 = sha256;
        }

        public WasmModule module() { return module; }

        /** Hex SHA-256 of the raw module bytes — the identity shown in the editor. */
        public String sha256() { return sha256; }
    }

    public static ValidatedModule validate(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new WasmModuleValidationException("SIZE", "module is empty");
        }
        if (bytes.length > MAX_MODULE_BYTES) {
            throw new WasmModuleValidationException("SIZE",
                "module is " + bytes.length + " bytes — the limit is " + MAX_MODULE_BYTES
                + " (see ADR 0003 for the content-addressed upload path)");
        }

        WasmModule module;
        try {
            module = Parser.parse(bytes);
        } catch (RuntimeException e) {
            throw new WasmModuleValidationException("PARSE",
                "not a valid WebAssembly module: " + e.getMessage());
        }

        if (module.importSection().importCount() > 0) {
            StringBuilder names = new StringBuilder();
            module.importSection().stream().limit(5).forEach(imp ->
                names.append(names.length() > 0 ? ", " : "")
                     .append(imp.module()).append('.').append(imp.name()));
            throw new WasmModuleValidationException("IMPORTS",
                "module declares imports (" + names
                + ") — action.wasm.execute modules must be pure compute with no imports, WASI included");
        }

        Map<String, Export> exports = new HashMap<>();
        for (int i = 0; i < module.exportSection().exportCount(); i++) {
            Export export = module.exportSection().getExport(i);
            exports.put(export.name(), export);
        }

        Export memoryExport = exports.get("memory");
        if (memoryExport == null || memoryExport.exportType() != ExternalType.MEMORY) {
            throw new WasmModuleValidationException("EXPORTS", "missing exported linear memory named 'memory'");
        }
        requireFunction(module, exports, "alloc", List.of(ValType.I32), List.of(ValType.I32));
        requireFunction(module, exports, "execute", List.of(ValType.I32, ValType.I32), List.of(ValType.I64));

        if (module.memorySection().isEmpty()
                || module.memorySection().get().memoryCount() == 0) {
            throw new WasmModuleValidationException("MEMORY_MAX", "module declares no linear memory");
        }
        var limits = module.memorySection().get().getMemory(0).limits();
        if (limits.maximumPages() > MAX_MEMORY_PAGES) {
            throw new WasmModuleValidationException("MEMORY_MAX",
                "declared memory maximum is " + describeMax(limits.maximumPages())
                + " — declare a maximum of at most " + MAX_MEMORY_PAGES
                + " pages (32 MiB), e.g. asc --maximumMemory 512 or rustc link-arg --max-memory=33554432");
        }

        return new ValidatedModule(module, sha256Hex(bytes));
    }

    private static void requireFunction(WasmModule module, Map<String, Export> exports,
                                        String name, List<ValType> params, List<ValType> returns) {
        Export export = exports.get(name);
        if (export == null || export.exportType() != ExternalType.FUNCTION) {
            throw new WasmModuleValidationException("EXPORTS",
                "missing exported function '" + name + "'");
        }
        // Imports are already known to be empty, so the export index addresses
        // the module's own function space directly.
        FunctionType type = module.functionSection()
            .getFunctionType(export.index(), module.typeSection());
        if (!type.params().equals(params) || !type.returns().equals(returns)) {
            throw new WasmModuleValidationException("EXPORTS",
                "'" + name + "' has signature " + type + " — expected params " + params
                + " and returns " + returns + " (ADR 0003 ABI v1)");
        }
    }

    private static String describeMax(int maximumPages) {
        // The parser materializes an absent maximum as the spec ceiling.
        return maximumPages >= 65_536 ? "absent (unbounded)" : maximumPages + " pages";
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** A module failed validation; {@link #rule()} names the rule for the editor. */
    public static class WasmModuleValidationException extends RuntimeException {
        private final String rule;

        public WasmModuleValidationException(String rule, String message) {
            super("[" + rule + "] " + message);
            this.rule = rule;
        }

        public String rule() { return rule; }
    }
}

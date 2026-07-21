package com.modulo.blueprint.wasm;

import static org.assertj.core.api.Assertions.*;

import com.dylibso.chicory.wasm.WasmModule;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.InputStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * action.wasm.execute validation and execution (#403) against the fixture
 * modules in src/test/resources/wasm/ — see the README there for provenance.
 * The conforming fixtures are the example modules' build output, so these
 * tests are also the ABI's conformance suite (ADR 0003).
 */
@DisplayName("action.wasm.execute — module validation and execution")
class WasmNodeTest {

    private static byte[] fixture(String name) {
        try (InputStream in = WasmNodeTest.class.getResourceAsStream("/wasm/" + name)) {
            if (in == null) throw new IllegalStateException("missing fixture " + name);
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ---------- Validation: conforming modules ----------

    @Test
    void assemblyScriptExampleValidates() {
        WasmModuleValidator.ValidatedModule validated = WasmModuleValidator.validate(fixture("titlecase.wasm"));
        assertThat(validated.module()).isNotNull();
        assertThat(validated.sha256()).hasSize(64);
    }

    @Test
    void rustExampleValidates() {
        assertThat(WasmModuleValidator.validate(fixture("wordstats.wasm")).module()).isNotNull();
    }

    // ---------- Validation: rejections, each naming its rule ----------

    @Test
    void moduleWithImportsIsRejected() {
        assertThatThrownBy(() -> WasmModuleValidator.validate(fixture("imports.wasm")))
            .isInstanceOf(WasmModuleValidator.WasmModuleValidationException.class)
            .hasMessageContaining("[IMPORTS]")
            .hasMessageContaining("hostEscape");
    }

    @Test
    void moduleMissingExecuteExportIsRejected() {
        assertThatThrownBy(() -> WasmModuleValidator.validate(fixture("noexec.wasm")))
            .isInstanceOf(WasmModuleValidator.WasmModuleValidationException.class)
            .hasMessageContaining("[EXPORTS]")
            .hasMessageContaining("execute");
    }

    @Test
    void moduleWithoutMemoryMaximumIsRejected() {
        assertThatThrownBy(() -> WasmModuleValidator.validate(fixture("nomax.wasm")))
            .isInstanceOf(WasmModuleValidator.WasmModuleValidationException.class)
            .hasMessageContaining("[MEMORY_MAX]");
    }

    @Test
    void oversizedModuleIsRejected() {
        byte[] tooBig = new byte[WasmModuleValidator.MAX_MODULE_BYTES + 1];
        assertThatThrownBy(() -> WasmModuleValidator.validate(tooBig))
            .isInstanceOf(WasmModuleValidator.WasmModuleValidationException.class)
            .hasMessageContaining("[SIZE]");
    }

    @Test
    void garbageBytesAreRejected() {
        assertThatThrownBy(() -> WasmModuleValidator.validate(new byte[] {1, 2, 3, 4, 5}))
            .isInstanceOf(WasmModuleValidator.WasmModuleValidationException.class)
            .hasMessageContaining("[PARSE]");
    }

    // ---------- Execution: conforming modules ----------

    @Test
    void titlecaseModuleTransformsTheTitle() {
        WasmModule module = WasmModuleValidator.validate(fixture("titlecase.wasm")).module();
        String out = WasmNodeExecutor.execute(module, "hello wasm world", "ignored");
        assertThat(out).isEqualTo("Hello Wasm World");
    }

    @Test
    void wordstatsModuleCountsContent(){
        WasmModule module = WasmModuleValidator.validate(fixture("wordstats.wasm")).module();
        String out = WasmNodeExecutor.execute(module, "Report", "one two three");
        assertThat(out).isEqualTo("Report — 3 words, 13 chars");
    }

    @Test
    void unicodeSurvivesTheEnvelopeRoundTrip() {
        WasmModule module = WasmModuleValidator.validate(fixture("titlecase.wasm")).module();
        String out = WasmNodeExecutor.execute(module, "äöü über “quotes”", "");
        assertThat(out).isEqualTo("Äöü Über “quotes”");
    }

    @Test
    void escapedJsonInNoteFieldsIsDelivered() {
        WasmModule module = WasmModuleValidator.validate(fixture("titlecase.wasm")).module();
        // Title containing JSON metacharacters must round-trip through the envelope.
        String out = WasmNodeExecutor.execute(module, "a \"b\" \\c", "x\ny");
        assertThat(out).isEqualTo("A \"b\" \\c");
    }

    @Test
    void freshInstancePerExecution() {
        WasmModule module = WasmModuleValidator.validate(fixture("titlecase.wasm")).module();
        // Same module object executed twice — bump-allocator state must not carry over.
        assertThat(WasmNodeExecutor.execute(module, "first run", "")).isEqualTo("First Run");
        assertThat(WasmNodeExecutor.execute(module, "second run", "")).isEqualTo("Second Run");
    }

    // ---------- Execution: hostile modules fail safely ----------

    @Test
    void infiniteLoopModuleIsAbortedByLimits() {
        WasmModule module = WasmModuleValidator.validate(fixture("loop.wasm")).module();
        long start = System.currentTimeMillis();
        assertThatThrownBy(() -> WasmNodeExecutor.execute(module, "t", "c"))
            .isInstanceOf(WasmNodeExecutor.WasmExecutionException.class)
            .hasMessageMatching("(?s).*(limit|timeout).*");
        assertThat(System.currentTimeMillis() - start)
            .isLessThan(WasmNodeExecutor.WALL_TIMEOUT_MS + 2_000);
    }

    @Test
    void memoryBalloonModuleTrapsAtItsDeclaredMaximum() {
        WasmModule module = WasmModuleValidator.validate(fixture("balloon.wasm")).module();
        assertThatThrownBy(() -> WasmNodeExecutor.execute(module, "t", "c"))
            .isInstanceOf(WasmNodeExecutor.WasmExecutionException.class);
        // The failure is contained — the module still runs fresh afterwards.
        WasmModule ok = WasmModuleValidator.validate(fixture("titlecase.wasm")).module();
        assertThat(WasmNodeExecutor.execute(ok, "still alive", "")).isEqualTo("Still Alive");
    }
}

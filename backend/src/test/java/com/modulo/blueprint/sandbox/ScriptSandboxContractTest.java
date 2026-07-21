package com.modulo.blueprint.sandbox;

import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * The ScriptSandbox contract, proven against every implementation (#400).
 *
 * One parameterized suite runs against both engines so parity is mechanical,
 * not asserted. Absorbs the assertions of the retired
 * SandboxedScriptServiceTest (Rhino-only) unchanged.
 *
 * Engine-specific differences that are intentional (not parity bugs) live in
 * docs/blueprint/wasm-sandbox-drift.md; anything asserted here must hold for
 * every implementation.
 */
@DisplayName("ScriptSandbox contract — every implementation")
class ScriptSandboxContractTest {

    static Stream<ScriptSandbox> sandboxes() {
        return Stream.of(new RhinoScriptSandbox(), new WasmScriptSandbox());
    }

    // ---------- Basic execution (absorbed from SandboxedScriptServiceTest) ----------

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void returnsStringResultFromBasicFunction(ScriptSandbox sandbox) {
        String result = sandbox.execute(
            "function(note) { return note.title.toUpperCase(); }", "hello", "body");
        assertThat(result).isEqualTo("HELLO");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void noteTitleAndContentAreInjected(ScriptSandbox sandbox) {
        String result = sandbox.execute(
            "function(note) { return note.title + '|' + note.content; }", "MyTitle", "MyBody");
        assertThat(result).isEqualTo("MyTitle|MyBody");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void nullNoteFieldsDefaultToEmptyString(ScriptSandbox sandbox) {
        String result = sandbox.execute(
            "function(note) { return note.title + note.content; }", null, null);
        assertThat(result).isEqualTo("");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void arrowFunctionSyntaxIsSupported(ScriptSandbox sandbox) {
        String result = sandbox.execute("(note) => note.title + ' — ' + note.content", "T", "C");
        assertThat(result).isEqualTo("T — C");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void unicodeRoundTripsIntact(ScriptSandbox sandbox) {
        String result = sandbox.execute(
            "(note) => note.title + note.content", "äöü€ — ", "日本語");
        assertThat(result).isEqualTo("äöü€ — 日本語");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void returnValueIsCoercedToString(ScriptSandbox sandbox) {
        assertThat(sandbox.execute("function(note) { return 42; }", "", "")).isEqualTo("42");
        assertThat(sandbox.execute("function(note) { return true; }", "", "")).isEqualTo("true");
        assertThat(sandbox.execute("function(note) { return [1,2,3]; }", "", "")).isEqualTo("1,2,3");
        assertThat(sandbox.execute("function(note) { return null; }", "", "")).isEqualTo("null");
        assertThat(sandbox.execute("function(note) { }", "", "")).isEqualTo("undefined");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void multilineResultIsPreserved(ScriptSandbox sandbox) {
        String result = sandbox.execute("(note) => 'a\\nb\\nc'", "", "");
        assertThat(result).isEqualTo("a\nb\nc");
    }

    // ---------- Errors ----------

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void syntaxErrorThrowsScriptExecutionException(ScriptSandbox sandbox) {
        assertThatThrownBy(() -> sandbox.execute("function(note { return 1; }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void runtimeErrorThrowsScriptExecutionException(ScriptSandbox sandbox) {
        assertThatThrownBy(() -> sandbox.execute("function(note) { return missing.prop; }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class);
    }

    // ---------- Isolation: host access ----------

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void javaPackageAccessIsBlocked(ScriptSandbox sandbox) {
        assertThatThrownBy(() ->
            sandbox.execute("function(note) { return java.lang.System.getProperty('user.dir'); }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void packagesGlobalIsAbsent(ScriptSandbox sandbox) {
        assertThatThrownBy(() ->
            sandbox.execute("function(note) { return Packages.java.lang.Math.PI; }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void ioAndHostGlobalsAreAbsent(ScriptSandbox sandbox) {
        // typeof probes must all report undefined — no I/O or host surface exists.
        String result = sandbox.execute(
            "function(note) { return [typeof fetch, typeof XMLHttpRequest, typeof require," +
            " typeof process, typeof JavaImporter, typeof JavaAdapter].join(','); }", "", "");
        assertThat(result).isEqualTo("undefined,undefined,undefined,undefined,undefined,undefined");
    }

    // ---------- Isolation: state between runs ----------

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void multipleSequentialCallsAreIsolated(ScriptSandbox sandbox) {
        String r1 = sandbox.execute("function(note) { globalThis.leak = 99; return 'set'; }", "", "");
        String r2 = sandbox.execute("function(note) { return typeof globalThis.leak; }", "", "");
        assertThat(r1).isEqualTo("set");
        // leak must not bleed between executions — each call gets a fresh world
        assertThat(r2).isEqualTo("undefined");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void prototypePollutionDoesNotSurviveTheRun(ScriptSandbox sandbox) {
        sandbox.execute("function(note) { Object.prototype.polluted = 'yes'; return 'done'; }", "", "");
        String result = sandbox.execute("function(note) { return typeof ({}).polluted; }", "", "");
        assertThat(result).isEqualTo("undefined");
    }

    // ---------- Resource limits ----------

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void infiniteLoopIsAborted(ScriptSandbox sandbox) {
        long start = System.currentTimeMillis();
        assertThatThrownBy(() -> sandbox.execute("function(note) { while(true) {} }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class)
            // Rhino trips its instruction limit, wasm its wall-clock budget — both are limits.
            .hasMessageMatching("(?s).*(limit|timeout).*");
        // Whatever the mechanism, the abort must come within the wall-clock budget (+ margin).
        assertThat(System.currentTimeMillis() - start).isLessThan(ScriptSandbox.WALL_TIMEOUT_MS + 2_000);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void busySpinIsAbortedWithinWallClockBudget(ScriptSandbox sandbox) {
        long start = System.currentTimeMillis();
        assertThatThrownBy(() -> sandbox.execute(
            "function(note) { let x = 0; while(true) { x = (x + 1) % 7; } }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class);
        assertThat(System.currentTimeMillis() - start).isLessThan(ScriptSandbox.WALL_TIMEOUT_MS + 2_000);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void deepRecursionFailsSafely(ScriptSandbox sandbox) {
        // Must abort via a sandbox limit (instructions / timeout / engine stack guard),
        // never damage the JVM.
        assertThatThrownBy(() -> sandbox.execute("function f(note) { return f(note); }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class);
        // The sandbox must still be usable afterwards.
        assertThat(sandbox.execute("(note) => 'alive'", "", "")).isEqualTo("alive");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void outputExceedingLimitIsTruncated(ScriptSandbox sandbox) {
        String result = sandbox.execute(
            "function(note) { return 'x'.repeat(" + (ScriptSandbox.MAX_OUTPUT_CHARS + 100) + "); }", "", "");
        assertThat(result).endsWith("[truncated]");
        assertThat(result.length())
            .isLessThanOrEqualTo(ScriptSandbox.MAX_OUTPUT_CHARS + "[truncated]".length());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("sandboxes")
    void memoryBalloonFailsSafely(ScriptSandbox sandbox) {
        // Only the wasm engine has a hard memory cap; Rhino relies on its
        // instruction limit to bound allocation (documented in the drift log).
        assumeTrue(sandbox instanceof WasmScriptSandbox, "hard memory cap is wasm-only");
        assertThatThrownBy(() -> sandbox.execute(
            "function(note) { let a = []; let s = 'x'; while(true) { s = s + s; a.push(s); } }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class);
        // The engine survives for the next run — the failure was contained.
        assertThat(sandbox.execute("(note) => 'alive'", "", "")).isEqualTo("alive");
    }

    // ---------- Semantics drift check (#400): identical output on both engines ----------

    /**
     * Realistic user scripts must produce byte-identical results on every engine.
     * Legitimate divergences belong in docs/blueprint/wasm-sandbox-drift.md, not here.
     */
    @Test
    @DisplayName("drift corpus: realistic scripts agree across engines")
    void driftCorpusAgreesAcrossEngines() {
        List<String> corpus = List.of(
            "(note) => JSON.stringify({t: note.title, n: [1, 2, 3]})",
            "(note) => JSON.parse('{\"a\": [1, 2]}').a.length",
            "(note) => note.content.replace(/(\\w+)@(\\w+)/g, '$2 at $1')",
            "(note) => `title: ${note.title.trim()} (${note.title.length})`",
            "(note) => [3, 1, 2].sort().map(x => x * 2).filter(x => x > 2).reduce((a, b) => a + b, 0)",
            "(note) => note.title.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')",
            // parseInt('08') intentionally absent: documented drift (see wasm-sandbox-drift.md)
            "(note) => (1 / 3).toFixed(4) + '|' + Number('0x1F') + '|' + parseInt('8')",
            "(note) => new Date(0).toISOString()",
            "(note) => encodeURIComponent('a b/ä') + '|' + 'abc'.padStart(5, '.')",
            // destructuring/spread intentionally absent: Rhino can't parse them (drift log)
            "(note) => { var parts = note.title.split(''); return parts.length + ':' + note.content.charAt(0); }"
        );
        ScriptSandbox rhino = new RhinoScriptSandbox();
        ScriptSandbox wasm = new WasmScriptSandbox();
        for (String script : corpus) {
            String a = rhino.execute(script, "hello world", "mail me: a@b now");
            String b = wasm.execute(script, "hello world", "mail me: a@b now");
            assertThat(b).as("engines disagree on: %s", script).isEqualTo(a);
        }
    }
}

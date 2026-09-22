package com.modulo.blueprint.sandbox;

import static org.assertj.core.api.Assertions.*;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * The ScriptSandbox contract, proven against every implementation (#400).
 *
 * One suite runs against the supported WASM implementation. It absorbs the
 * assertions of the retired Rhino-only test surface unchanged.
 *
 * Engine-specific differences that are intentional (not parity bugs) live in
 * docs/blueprint/wasm-sandbox-drift.md; anything asserted here must hold for
 * every implementation.
 */
@DisplayName("ScriptSandbox contract — every implementation")
class ScriptSandboxContractTest {

    static Stream<ScriptSandbox> sandboxes() {
        return Stream.of(new WasmScriptSandbox());
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
        assertThatThrownBy(() -> sandbox.execute(
            "function(note) { let a = []; let s = 'x'; while(true) { s = s + s; a.push(s); } }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class);
        // The engine survives for the next run — the failure was contained.
        assertThat(sandbox.execute("(note) => 'alive'", "", "")).isEqualTo("alive");
    }

}

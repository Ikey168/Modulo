package com.modulo.blueprint.sandbox;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

@DisplayName("SandboxedScriptService — isolation and execution")
class SandboxedScriptServiceTest {

    private SandboxedScriptService service;

    @BeforeEach
    void setUp() {
        service = new SandboxedScriptService();
    }

    @Test
    void returnsStringResultFromBasicFunction() {
        String result = service.execute(
            "function(note) { return note.title.toUpperCase(); }",
            "hello", "body"
        );
        assertThat(result).isEqualTo("HELLO");
    }

    @Test
    void noteTitleAndContentAreInjected() {
        String result = service.execute(
            "function(note) { return note.title + '|' + note.content; }",
            "MyTitle", "MyBody"
        );
        assertThat(result).isEqualTo("MyTitle|MyBody");
    }

    @Test
    void nullNoteFieldsDefaultToEmptyString() {
        String result = service.execute(
            "function(note) { return note.title + note.content; }",
            null, null
        );
        assertThat(result).isEqualTo("");
    }

    @Test
    void arrowFunctionSyntaxIsSupported() {
        String result = service.execute(
            "(note) => note.title + ' — ' + note.content",
            "T", "C"
        );
        assertThat(result).isEqualTo("T — C");
    }

    @Test
    void infiniteLoopIsAbortedByInstructionLimit() {
        assertThatThrownBy(() ->
            service.execute("function(note) { while(true) {} }", "", "")
        ).isInstanceOf(SandboxedScriptService.ScriptExecutionException.class)
         .hasMessageContaining("instruction limit");
    }

    @Test
    void javaPackageAccessIsBlocked() {
        assertThatThrownBy(() ->
            service.execute("function(note) { return java.lang.System.getProperty('user.dir'); }", "", "")
        ).isInstanceOf(SandboxedScriptService.ScriptExecutionException.class);
    }

    @Test
    void packagesGlobalIsAbsent() {
        assertThatThrownBy(() ->
            service.execute("function(note) { return Packages.java.lang.Math.PI; }", "", "")
        ).isInstanceOf(SandboxedScriptService.ScriptExecutionException.class);
    }

    @Test
    void syntaxErrorThrowsScriptExecutionException() {
        assertThatThrownBy(() ->
            service.execute("function(note { return 1; }", "", "")
        ).isInstanceOf(SandboxedScriptService.ScriptExecutionException.class);
    }

    @Test
    void returnValueIsCoercedToString() {
        String result = service.execute("function(note) { return 42; }", "", "");
        assertThat(result).isEqualTo("42");
    }

    @Test
    void outputExceedingLimitIsTruncated() {
        // Generate a string longer than MAX_OUTPUT_CHARS via JS repeat
        String result = service.execute(
            "function(note) { return 'x'.repeat(" + (SandboxedScriptService.MAX_OUTPUT_CHARS + 100) + "); }",
            "", ""
        );
        assertThat(result).endsWith("[truncated]");
        assertThat(result.length()).isLessThanOrEqualTo(SandboxedScriptService.MAX_OUTPUT_CHARS + "[truncated]".length());
    }

    @Test
    void multipleSequentialCallsAreIsolated() {
        String r1 = service.execute("function(note) { globalVar = 99; return 'set'; }", "", "");
        String r2 = service.execute("function(note) { return typeof globalVar; }", "", "");
        assertThat(r1).isEqualTo("set");
        // globalVar must not bleed between executions — each call gets a fresh scope
        assertThat(r2).isEqualTo("undefined");
    }
}

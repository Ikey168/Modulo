package com.modulo.blueprint.sandbox;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("ScriptSandboxConfig — engine selection (#397)")
class ScriptSandboxConfigTest {

    private final ScriptSandboxConfig config = new ScriptSandboxConfig();

    @Test
    void rhinoSelectsRhinoEngine() {
        assertThat(config.scriptSandbox("rhino")).isInstanceOf(RhinoScriptSandbox.class);
    }

    @Test
    void wasmSelectsWasmEngine() {
        assertThat(config.scriptSandbox("wasm")).isInstanceOf(WasmScriptSandbox.class);
    }

    @Test
    void unknownValueFailsLoudly() {
        assertThatThrownBy(() -> config.scriptSandbox("graal"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("modulo.blueprint.sandbox")
            .hasMessageContaining("graal");
    }
}

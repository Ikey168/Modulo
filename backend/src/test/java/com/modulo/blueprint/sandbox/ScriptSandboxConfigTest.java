package com.modulo.blueprint.sandbox;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;

@DisplayName("ScriptSandboxConfig — engine selection (#397) + remote wrapper (#393)")
class ScriptSandboxConfigTest {

    private final ScriptSandboxConfig config = new ScriptSandboxConfig();

    @SuppressWarnings("unchecked")
    private ObjectProvider<com.modulo.plugin.manager.PluginManager> noManager() {
        return (ObjectProvider<com.modulo.plugin.manager.PluginManager>)
            org.mockito.Mockito.mock(ObjectProvider.class);
    }

    @Test
    void rhinoSelectsRhinoEngine() {
        assertThat(config.localEngine("rhino")).isInstanceOf(RhinoScriptSandbox.class);
    }

    @Test
    void wasmSelectsWasmEngine() {
        assertThat(config.localEngine("wasm")).isInstanceOf(WasmScriptSandbox.class);
    }

    @Test
    void unknownValueFailsLoudly() {
        assertThatThrownBy(() -> config.localEngine("graal"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("modulo.blueprint.sandbox")
            .hasMessageContaining("graal");
    }

    @Test
    void beanWrapsTheLocalEngineInTheRemoteRouter() {
        ScriptSandbox sandbox = config.scriptSandbox("wasm", noManager());
        assertThat(sandbox).isInstanceOf(RemoteScriptSandbox.class);
        assertThat(((RemoteScriptSandbox) sandbox).getFallback()).isInstanceOf(WasmScriptSandbox.class);
    }

    @Test
    void wrappedSandboxWorksWithNoPluginManagerPresent() {
        // The Pi/minimal path: no manager, no plugin — pure pass-through.
        ScriptSandbox sandbox = config.scriptSandbox("rhino", noManager());
        assertThat(sandbox.execute("(note) => note.title", "t", "c")).isEqualTo("t");
    }
}

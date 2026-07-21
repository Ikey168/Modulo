package com.modulo.blueprint.sandbox;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.google.protobuf.ByteString;
import com.modulo.plugin.grpc.ExecuteResponse;
import com.modulo.plugin.manager.ExternalPluginProxy;
import com.modulo.plugin.manager.PluginManager;
import com.modulo.plugin.manager.PluginStatus;
import io.grpc.Status;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Remote routing semantics of the script sandbox facade (#393): remote when
 * healthy, in-process fallback on absence/transport failure, script errors
 * rethrown rather than silently retried locally.
 */
@DisplayName("RemoteScriptSandbox — routing and fallback")
class RemoteScriptSandboxTest {

    private final PluginManager manager = mock(PluginManager.class);
    private final ExternalPluginProxy proxy = mock(ExternalPluginProxy.class);
    private final ScriptSandbox fallback = mock(ScriptSandbox.class);
    private RemoteScriptSandbox sandbox;

    @BeforeEach
    void setUp() {
        sandbox = new RemoteScriptSandbox(() -> manager, fallback);
        when(fallback.execute(any(), any(), any())).thenReturn("local-result");
    }

    private void attachHealthyRemote() {
        when(manager.getActivePlugins())
            .thenReturn(Map.of(RemoteScriptSandbox.PLUGIN_NAME, proxy));
        when(manager.getPluginStatus(RemoteScriptSandbox.PLUGIN_NAME))
            .thenReturn(PluginStatus.ACTIVE);
    }

    @Test
    void routesToTheRemoteWorkloadWhenHealthy() {
        attachHealthyRemote();
        when(proxy.execute(eq("script.execute"), anyMap(), anyInt()))
            .thenReturn(ExecuteResponse.newBuilder()
                .setSuccess(true)
                .setResultPayload(ByteString.copyFromUtf8("remote-result"))
                .build());

        assertThat(sandbox.execute("(note) => 1", "t", "c")).isEqualTo("remote-result");
        verifyNoInteractions(fallback);
    }

    @Test
    void fallsBackWhenNoPluginIsAttached() {
        when(manager.getActivePlugins()).thenReturn(Map.of());

        assertThat(sandbox.execute("(note) => 1", "t", "c")).isEqualTo("local-result");
        verifyNoInteractions(proxy);
    }

    @Test
    void fallsBackWhenThePluginIsUnhealthy() {
        when(manager.getActivePlugins())
            .thenReturn(Map.of(RemoteScriptSandbox.PLUGIN_NAME, proxy));
        when(manager.getPluginStatus(RemoteScriptSandbox.PLUGIN_NAME))
            .thenReturn(PluginStatus.ERROR);

        assertThat(sandbox.execute("(note) => 1", "t", "c")).isEqualTo("local-result");
        verify(proxy, never()).execute(any(), anyMap(), anyInt());
    }

    @Test
    void fallsBackOnTransportFailureMidCall() {
        attachHealthyRemote();
        when(proxy.execute(any(), anyMap(), anyInt()))
            .thenThrow(Status.UNAVAILABLE.asRuntimeException());

        assertThat(sandbox.execute("(note) => 1", "t", "c")).isEqualTo("local-result");
    }

    @Test
    void remoteScriptErrorIsRethrownNotRetriedLocally() {
        attachHealthyRemote();
        when(proxy.execute(any(), anyMap(), anyInt()))
            .thenReturn(ExecuteResponse.newBuilder()
                .setSuccess(false)
                .setErrorCode("SCRIPT_ERROR")
                .setMessage("Script wall-clock timeout exceeded")
                .build());

        assertThatThrownBy(() -> sandbox.execute("function(note) { while(true){} }", "", ""))
            .isInstanceOf(ScriptSandbox.ScriptExecutionException.class)
            .hasMessageContaining("timeout");
        verifyNoInteractions(fallback);
    }

    @Test
    void nonScriptRemoteFailureFallsBack() {
        attachHealthyRemote();
        when(proxy.execute(any(), anyMap(), anyInt()))
            .thenReturn(ExecuteResponse.newBuilder()
                .setSuccess(false)
                .setErrorCode("INTERNAL")
                .setMessage("boom")
                .build());

        assertThat(sandbox.execute("(note) => 1", "t", "c")).isEqualTo("local-result");
    }

    @Test
    void nullManagerMeansPurePassThrough() {
        RemoteScriptSandbox detached = new RemoteScriptSandbox(() -> null, fallback);
        assertThat(detached.execute("(note) => 1", "t", "c")).isEqualTo("local-result");
    }
}

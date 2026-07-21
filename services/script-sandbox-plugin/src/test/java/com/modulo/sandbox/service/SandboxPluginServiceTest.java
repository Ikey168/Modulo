package com.modulo.sandbox.service;

import static org.assertj.core.api.Assertions.*;

import com.modulo.plugin.grpc.*;
import io.grpc.ManagedChannel;
import io.grpc.Server;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Contract conformance of the script-sandbox workload (#393): lifecycle +
 * health over the wire, script execution through the WASM engine, and
 * hostile scripts dying at the engine limits without harming the service.
 */
@DisplayName("script-sandbox plugin — contract lifecycle and execution")
class SandboxPluginServiceTest {

    private Server server;
    private ManagedChannel channel;
    private PluginServiceGrpc.PluginServiceBlockingStub stub;

    @BeforeEach
    void setUp() throws Exception {
        String name = InProcessServerBuilder.generateName();
        server = InProcessServerBuilder.forName(name)
            .addService(new SandboxPluginService("wasm"))
            .build().start();
        channel = InProcessChannelBuilder.forName(name).build();
        stub = PluginServiceGrpc.newBlockingStub(channel);
    }

    @AfterEach
    void tearDown() throws Exception {
        channel.shutdownNow();
        server.shutdownNow();
        channel.awaitTermination(5, TimeUnit.SECONDS);
        server.awaitTermination(5, TimeUnit.SECONDS);
    }

    private ExecuteResponse execute(String code, String title, String content) {
        return stub.withDeadlineAfter(30, TimeUnit.SECONDS).execute(ExecuteRequest.newBuilder()
            .setPluginId(SandboxPluginService.PLUGIN_NAME)
            .setOperation(SandboxPluginService.OPERATION)
            .putParameters("code", code)
            .putParameters("title", title)
            .putParameters("content", content)
            .build());
    }

    @Test
    void lifecycleAndHealthRoundTrip() {
        assertThat(stub.getInfo(InfoRequest.newBuilder().build()).getName())
            .isEqualTo("script-sandbox");
        assertThat(stub.getCapabilities(CapabilitiesRequest.newBuilder().build())
            .getSupportedOperationsList()).containsExactly("script.execute");

        // Not started yet → unhealthy.
        assertThat(stub.healthCheck(HealthCheckRequest.newBuilder().build()).getHealth())
            .isEqualTo(HealthStatus.UNHEALTHY);

        assertThat(stub.initialize(InitializeRequest.newBuilder().build()).getSuccess()).isTrue();
        assertThat(stub.start(StartRequest.newBuilder().build()).getSuccess()).isTrue();
        assertThat(stub.healthCheck(HealthCheckRequest.newBuilder().build()).getHealth())
            .isEqualTo(HealthStatus.HEALTHY);
        assertThat(stub.getStatus(StatusRequest.newBuilder().build()).getStatus())
            .isEqualTo(PluginStatus.ACTIVE);

        assertThat(stub.stop(StopRequest.newBuilder().build()).getSuccess()).isTrue();
        assertThat(stub.healthCheck(HealthCheckRequest.newBuilder().build()).getHealth())
            .isEqualTo(HealthStatus.UNHEALTHY);
    }

    @Test
    void executesScriptsRemotely() {
        ExecuteResponse response = execute(
            "function(note) { return note.title.toUpperCase() + '/' + note.content; }",
            "hello", "world");

        assertThat(response.getSuccess()).isTrue();
        assertThat(response.getResultPayload().toStringUtf8()).isEqualTo("HELLO/world");
    }

    @Test
    void scriptErrorsComeBackAsScriptErrorNotTransportFailure() {
        ExecuteResponse response = execute("function(note { broken", "", "");

        assertThat(response.getSuccess()).isFalse();
        assertThat(response.getErrorCode()).isEqualTo("SCRIPT_ERROR");
        assertThat(response.getMessage()).isNotBlank();
    }

    @Test
    void hostileInfiniteLoopDiesAtTheEngineLimitWithoutHarmingTheService() {
        long start = System.currentTimeMillis();
        ExecuteResponse response = execute("function(note) { while(true) {} }", "", "");

        assertThat(response.getSuccess()).isFalse();
        assertThat(response.getErrorCode()).isEqualTo("SCRIPT_ERROR");
        assertThat(System.currentTimeMillis() - start).isLessThan(10_000);

        // Service still serves the next request.
        assertThat(execute("(note) => 'alive'", "", "").getResultPayload().toStringUtf8())
            .isEqualTo("alive");
    }

    @Test
    void hostileMemoryBalloonDiesAtTheEngineLimit() {
        ExecuteResponse response = execute(
            "function(note) { let a = []; let s = 'x'; while(true) { s = s + s; a.push(s); } }", "", "");

        assertThat(response.getSuccess()).isFalse();
        assertThat(response.getErrorCode()).isEqualTo("SCRIPT_ERROR");
    }

    @Test
    void unsupportedOperationIsRejectedExplicitly() {
        ExecuteResponse response = stub.execute(ExecuteRequest.newBuilder()
            .setOperation("something.else").build());

        assertThat(response.getSuccess()).isFalse();
        assertThat(response.getErrorCode()).isEqualTo("UNSUPPORTED_OPERATION");
    }
}

package com.modulo.plugin.manager;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.grpc.*;
import com.modulo.plugin.registry.PluginRegistry;
import com.modulo.plugin.registry.PluginRegistryEntry;
import io.grpc.Server;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import io.grpc.stub.StreamObserver;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * EXTERNAL plugin runtime (#392): a stub plugin workload served on a random
 * localhost port, attached, driven, health-checked, re-attached, and torn
 * down through the real PluginManager + ExternalPluginProxy path.
 */
@DisplayName("PluginManager — EXTERNAL plugin runtime")
class ExternalPluginRuntimeTest {

    private static final String PLUGIN_NAME = "stub-external-plugin";

    /** A minimal external plugin workload implementing the v1 lifecycle contract. */
    static class StubPlugin extends PluginServiceGrpc.PluginServiceImplBase {
        final Map<String, String> receivedInitConfig = new ConcurrentHashMap<>();
        final AtomicBoolean started = new AtomicBoolean();
        final AtomicBoolean stopped = new AtomicBoolean();
        volatile HealthStatus health = HealthStatus.HEALTHY;

        @Override
        public void getInfo(InfoRequest request, StreamObserver<InfoResponse> observer) {
            observer.onNext(InfoResponse.newBuilder()
                .setName(PLUGIN_NAME).setVersion("1.0.0")
                .setDescription("stub").setAuthor("test")
                .addRequiredPermissions("notes.read")
                .build());
            observer.onCompleted();
        }

        @Override
        public void getCapabilities(CapabilitiesRequest request,
                                    StreamObserver<CapabilitiesResponse> observer) {
            observer.onNext(CapabilitiesResponse.newBuilder()
                .addSupportedOperations("stub.op")
                .addSupportedEvents("note.created")
                .build());
            observer.onCompleted();
        }

        @Override
        public void initialize(InitializeRequest request, StreamObserver<InitializeResponse> observer) {
            receivedInitConfig.putAll(request.getConfigMap());
            observer.onNext(InitializeResponse.newBuilder().setSuccess(true).build());
            observer.onCompleted();
        }

        @Override
        public void start(StartRequest request, StreamObserver<StartResponse> observer) {
            started.set(true);
            observer.onNext(StartResponse.newBuilder().setSuccess(true).build());
            observer.onCompleted();
        }

        @Override
        public void stop(StopRequest request, StreamObserver<StopResponse> observer) {
            stopped.set(true);
            observer.onNext(StopResponse.newBuilder().setSuccess(true).build());
            observer.onCompleted();
        }

        @Override
        public void healthCheck(HealthCheckRequest request, StreamObserver<HealthCheckResponse> observer) {
            observer.onNext(HealthCheckResponse.newBuilder()
                .setHealth(health).setMessage("stub health").build());
            observer.onCompleted();
        }
    }

    private Server server;
    private StubPlugin stub;
    private String endpoint;

    private PluginManager manager;
    private final PluginRegistry registry = mock(PluginRegistry.class);
    private final PluginLoader loader = mock(PluginLoader.class);
    private final PluginSecurityManager securityManager = new PluginSecurityManager();
    private final PluginEventBus eventBus = new PluginEventBus();

    @BeforeEach
    void setUp() throws Exception {
        stub = new StubPlugin();
        server = NettyServerBuilder.forPort(0).addService(stub).build().start();
        endpoint = "localhost:" + server.getPort();

        manager = new PluginManager();
        ReflectionTestUtils.setField(manager, "pluginRegistry", registry);
        ReflectionTestUtils.setField(manager, "pluginLoader", loader);
        ReflectionTestUtils.setField(manager, "securityManager", securityManager);
        ReflectionTestUtils.setField(manager, "eventBus", eventBus);
        when(registry.registerPlugin(any(), any())).thenReturn(1L);
    }

    @AfterEach
    void tearDown() {
        manager.getActivePlugins().values().forEach(p -> {
            if (p instanceof ExternalPluginProxy) ((ExternalPluginProxy) p).close();
        });
        server.shutdownNow();
    }

    // ------------------------------------------------------------------

    @Test
    void installAttachesStartsAndTracksTheWorkload() throws Exception {
        String pluginId = manager.installExternalPlugin(endpoint, Map.of("custom", "value"));

        assertThat(pluginId).isEqualTo(PLUGIN_NAME);
        assertThat(stub.started).isTrue();
        assertThat(manager.getPluginStatus(pluginId)).isEqualTo(PluginStatus.ACTIVE);
        assertThat(manager.getActivePlugins().get(pluginId)).isInstanceOf(ExternalPluginProxy.class);
        verify(registry).registerPlugin(any(), any());
        verify(registry).updatePluginRemoteInfo(PLUGIN_NAME, endpoint);
        assertThat(stub.receivedInitConfig).containsEntry("custom", "value");
    }

    @Test
    void installGrantsDeclaredPermissionsAndIssuesAValidToken() throws Exception {
        manager.installExternalPlugin(endpoint, Map.of());

        // Grant round-trip: the declared permission is granted, others denied —
        // the wire-level enforcement of these grants is covered by
        // PluginContractGrpcTest's granted-vs-denied cases.
        assertThat(securityManager.hasPermission(PLUGIN_NAME, "notes.read")).isTrue();
        assertThat(securityManager.hasPermission(PLUGIN_NAME, "notes.delete")).isFalse();

        // Token round-trip: the token handed to the plugin in Initialize is
        // exactly what the host-surface interceptor validates.
        String token = stub.receivedInitConfig.get("modulo.plugin.token");
        assertThat(token).isNotBlank();
        assertThat(securityManager.validatePluginToken(token)).isEqualTo(PLUGIN_NAME);
    }

    @Test
    void unreachableEndpointFailsInstallCleanly() {
        int deadPort = server.getPort() == 65535 ? 65534 : server.getPort() + 1;

        assertThatThrownBy(() -> manager.installExternalPlugin("localhost:" + deadPort, Map.of()))
            .isInstanceOf(PluginException.class)
            .hasMessageContaining("GetInfo");

        assertThat(manager.getActivePlugins()).isEmpty();
    }

    @Test
    void uninstallStopsTheRemoteWorkload() throws Exception {
        String pluginId = manager.installExternalPlugin(endpoint, Map.of());
        manager.uninstallPlugin(pluginId);

        assertThat(stub.stopped).isTrue();
        assertThat(manager.getActivePlugins()).doesNotContainKey(pluginId);
    }

    @Test
    void healthMonitorMarksErrorAfterConsecutiveFailuresAndRecovers() throws Exception {
        String pluginId = manager.installExternalPlugin(endpoint, Map.of());

        ExternalPluginHealthMonitor monitor = new ExternalPluginHealthMonitor();
        ReflectionTestUtils.setField(monitor, "pluginManager", manager);

        monitor.pollOnce();
        assertThat(manager.getPluginStatus(pluginId)).isEqualTo(PluginStatus.ACTIVE);

        stub.health = HealthStatus.UNHEALTHY;
        for (int i = 0; i < ExternalPluginHealthMonitor.FAILURE_THRESHOLD; i++) {
            monitor.pollOnce();
        }
        assertThat(manager.getPluginStatus(pluginId)).isEqualTo(PluginStatus.ERROR);

        stub.health = HealthStatus.HEALTHY;
        monitor.pollOnce();
        assertThat(manager.getPluginStatus(pluginId)).isEqualTo(PluginStatus.ACTIVE);
    }

    @Test
    void registeredExternalPluginReattachesOnStartup() {
        PluginRegistryEntry entry = new PluginRegistryEntry();
        entry.setName(PLUGIN_NAME);
        entry.setType("EXTERNAL");
        entry.setRuntime("GRPC");
        entry.setStatus(PluginStatus.ACTIVE);
        entry.setEndpoint(endpoint);
        entry.setConfig(Map.of("restored", "yes"));
        when(registry.getAllRegisteredPlugins()).thenReturn(List.of(entry));

        ReflectionTestUtils.invokeMethod(manager, "loadRegisteredPlugins");

        assertThat(manager.getActivePlugins()).containsKey(PLUGIN_NAME);
        assertThat(stub.started).isTrue();
        assertThat(stub.receivedInitConfig)
            .containsEntry("restored", "yes")
            .containsKey("modulo.plugin.token");
        assertThat(manager.getPluginStatus(PLUGIN_NAME)).isEqualTo(PluginStatus.ACTIVE);
    }

    @Test
    void downEndpointOnStartupYieldsErrorStatusNotAFailure() {
        PluginRegistryEntry entry = new PluginRegistryEntry();
        entry.setName(PLUGIN_NAME);
        entry.setType("EXTERNAL");
        entry.setRuntime("GRPC");
        entry.setStatus(PluginStatus.ACTIVE);
        int deadPort = server.getPort() == 65535 ? 65534 : server.getPort() + 1;
        entry.setEndpoint("localhost:" + deadPort);
        when(registry.getAllRegisteredPlugins()).thenReturn(List.of(entry));

        // Must not throw — a down pod never fails core startup (ADR 0004 §5).
        ReflectionTestUtils.invokeMethod(manager, "loadRegisteredPlugins");

        assertThat(manager.getActivePlugins()).doesNotContainKey(PLUGIN_NAME);
        assertThat(manager.getPluginStatus(PLUGIN_NAME)).isEqualTo(PluginStatus.ERROR);
    }
}

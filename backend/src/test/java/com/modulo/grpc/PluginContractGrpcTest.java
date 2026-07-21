package com.modulo.grpc;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.modulo.entity.Note;
import com.modulo.grpc.service.PluginHostServiceImpl;
import com.modulo.grpc.service.PluginServiceImpl;
import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.NotePluginAPI;
import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginInfo;
import com.modulo.plugin.api.PluginType;
import com.modulo.plugin.api.PluginRuntime;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.grpc.*;
import com.modulo.plugin.manager.PluginManager;
import com.modulo.plugin.manager.PluginSecurityManager;
import io.grpc.ManagedChannel;
import io.grpc.Metadata;
import io.grpc.Server;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import io.grpc.stub.MetadataUtils;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Contract v1 wire tests (#390): the lifecycle service round-trips
 * HealthCheck + GetInfo, and the host surface enforces authentication and
 * per-call permission gating — all over a real (in-process) gRPC transport,
 * interceptor included.
 */
@DisplayName("Plugin contract v1 — gRPC round-trips and permission gating")
class PluginContractGrpcTest {

    private static final String PLUGIN_ID = "test-plugin";
    private static final String TOKEN = "test-token";

    private Server server;
    private ManagedChannel channel;

    private final PluginManager pluginManager = mock(PluginManager.class);
    private final NotePluginAPI notePluginAPI = mock(NotePluginAPI.class);
    private final PluginSecurityManager securityManager = mock(PluginSecurityManager.class);
    private final PluginEventBus eventBus = mock(PluginEventBus.class);

    @BeforeEach
    void startServer() throws Exception {
        PluginServiceImpl lifecycle = new PluginServiceImpl();
        ReflectionTestUtils.setField(lifecycle, "pluginManager", pluginManager);

        PluginHostServiceImpl host = new PluginHostServiceImpl();
        ReflectionTestUtils.setField(host, "notePluginAPI", notePluginAPI);
        ReflectionTestUtils.setField(host, "securityManager", securityManager);
        ReflectionTestUtils.setField(host, "eventBus", eventBus);

        PluginAuthInterceptor interceptor = new PluginAuthInterceptor();
        ReflectionTestUtils.setField(interceptor, "securityManager", securityManager);

        when(securityManager.validatePluginToken(TOKEN)).thenReturn(PLUGIN_ID);

        String name = InProcessServerBuilder.generateName();
        server = InProcessServerBuilder.forName(name).directExecutor()
            .addService(lifecycle)
            .addService(host)
            .intercept(interceptor)
            .build().start();
        channel = InProcessChannelBuilder.forName(name).directExecutor().build();
    }

    @AfterEach
    void stopServer() throws Exception {
        channel.shutdownNow();
        server.shutdownNow();
        channel.awaitTermination(5, TimeUnit.SECONDS);
        server.awaitTermination(5, TimeUnit.SECONDS);
    }

    // ------------------------------------------------------------------
    // Lifecycle service (#390 acceptance: HealthCheck + GetInfo round-trip)
    // ------------------------------------------------------------------

    @Test
    void healthCheckRoundTripsOverTheWire() {
        Plugin plugin = mock(Plugin.class);
        when(plugin.healthCheck()).thenReturn(HealthCheck.healthy("all good"));
        when(pluginManager.getPlugin(PLUGIN_ID)).thenReturn(plugin);

        PluginServiceGrpc.PluginServiceBlockingStub stub = PluginServiceGrpc.newBlockingStub(channel);
        HealthCheckResponse response = stub.healthCheck(
            HealthCheckRequest.newBuilder().setPluginId(PLUGIN_ID).build());

        assertThat(response.getHealth()).isEqualTo(HealthStatus.HEALTHY);
    }

    @Test
    void getInfoRoundTripsOverTheWire() {
        Plugin plugin = mock(Plugin.class);
        when(plugin.getInfo()).thenReturn(new PluginInfo(
            "Test Plugin", "1.2.3", "a test plugin", "modulo",
            PluginType.EXTERNAL, PluginRuntime.GRPC));
        when(pluginManager.getPlugin(PLUGIN_ID)).thenReturn(plugin);

        InfoResponse response = PluginServiceGrpc.newBlockingStub(channel)
            .getInfo(InfoRequest.newBuilder().setPluginId(PLUGIN_ID).build());

        assertThat(response.getName()).isEqualTo("Test Plugin");
        assertThat(response.getVersion()).isEqualTo("1.2.3");
    }

    // ------------------------------------------------------------------
    // Host surface: authentication
    // ------------------------------------------------------------------

    private PluginHostServiceGrpc.PluginHostServiceBlockingStub authedStub() {
        Metadata headers = new Metadata();
        headers.put(PluginAuthInterceptor.PLUGIN_ID_HEADER, PLUGIN_ID);
        headers.put(PluginAuthInterceptor.PLUGIN_TOKEN_HEADER, TOKEN);
        return PluginHostServiceGrpc.newBlockingStub(channel)
            .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(headers));
    }

    @Test
    void hostCallWithoutCredentialsIsUnauthenticated() {
        assertThatThrownBy(() -> PluginHostServiceGrpc.newBlockingStub(channel)
                .getNote(GetNoteRequest.newBuilder().setNoteId(1).build()))
            .isInstanceOfSatisfying(StatusRuntimeException.class, e ->
                assertThat(e.getStatus().getCode()).isEqualTo(Status.Code.UNAUTHENTICATED));
    }

    @Test
    void hostCallWithBadTokenIsUnauthenticated() {
        Metadata headers = new Metadata();
        headers.put(PluginAuthInterceptor.PLUGIN_ID_HEADER, PLUGIN_ID);
        headers.put(PluginAuthInterceptor.PLUGIN_TOKEN_HEADER, "forged");
        var stub = PluginHostServiceGrpc.newBlockingStub(channel)
            .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(headers));

        assertThatThrownBy(() -> stub.getNote(GetNoteRequest.newBuilder().setNoteId(1).build()))
            .isInstanceOfSatisfying(StatusRuntimeException.class, e ->
                assertThat(e.getStatus().getCode()).isEqualTo(Status.Code.UNAUTHENTICATED));
    }

    @Test
    void lifecycleServiceIsNotGuardedByPluginAuth() {
        // The interceptor guards only PluginHostService — lifecycle calls
        // (operator surface) pass through without plugin credentials.
        Plugin plugin = mock(Plugin.class);
        when(plugin.healthCheck()).thenReturn(HealthCheck.healthy("ok"));
        when(pluginManager.getPlugin(PLUGIN_ID)).thenReturn(plugin);

        HealthCheckResponse response = PluginServiceGrpc.newBlockingStub(channel)
            .healthCheck(HealthCheckRequest.newBuilder().setPluginId(PLUGIN_ID).build());
        assertThat(response.getHealth()).isEqualTo(HealthStatus.HEALTHY);
    }

    // ------------------------------------------------------------------
    // Host surface: permission gating (#390 acceptance: granted vs denied)
    // ------------------------------------------------------------------

    @Test
    void grantedPermissionAllowsTheCall() {
        when(securityManager.hasPermission(PLUGIN_ID, "notes.read")).thenReturn(true);
        Note note = new Note();
        note.setId(42L);
        note.setTitle("hello");
        when(notePluginAPI.findById(42L)).thenReturn(Optional.of(note));

        GetNoteResponse response = authedStub()
            .getNote(GetNoteRequest.newBuilder().setNoteId(42).build());

        assertThat(response.getFound()).isTrue();
        assertThat(response.getNote().getTitle()).isEqualTo("hello");
    }

    @Test
    void deniedPermissionRejectsTheCall() {
        when(securityManager.hasPermission(PLUGIN_ID, "notes.read")).thenReturn(false);

        assertThatThrownBy(() -> authedStub()
                .getNote(GetNoteRequest.newBuilder().setNoteId(42).build()))
            .isInstanceOfSatisfying(StatusRuntimeException.class, e -> {
                assertThat(e.getStatus().getCode()).isEqualTo(Status.Code.PERMISSION_DENIED);
                assertThat(e.getStatus().getDescription()).contains("notes.read");
            });
        verifyNoInteractions(notePluginAPI);
    }

    @Test
    void writePermissionIsCheckedIndependentlyOfRead() {
        when(securityManager.hasPermission(PLUGIN_ID, "notes.read")).thenReturn(true);
        when(securityManager.hasPermission(PLUGIN_ID, "notes.write")).thenReturn(false);

        assertThatThrownBy(() -> authedStub().saveNote(SaveNoteRequest.newBuilder()
                .setNote(NotePayload.newBuilder().setTitle("t").setContent("c"))
                .build()))
            .isInstanceOfSatisfying(StatusRuntimeException.class, e ->
                assertThat(e.getStatus().getCode()).isEqualTo(Status.Code.PERMISSION_DENIED));
    }

    @Test
    void publishEventStampsOriginFromAuthenticatedIdentity() {
        when(securityManager.hasPermission(PLUGIN_ID, "system.events.publish")).thenReturn(true);

        PublishEventResponse response = authedStub().publishEvent(PublishEventRequest.newBuilder()
            .setEvent(EventEnvelope.newBuilder()
                .setType("custom.thing")
                .setOrigin("core") // spoof attempt — must be overridden
                .setJsonPayload("{\"metadata\":{\"k\":\"v\"}}"))
            .build());

        assertThat(response.getAccepted()).isTrue();
        verify(eventBus).publish(argThat(event ->
            event instanceof com.modulo.plugin.event.RemotePluginEvent
                && "custom.thing".equals(event.getType())
                && ("plugin:" + PLUGIN_ID).equals(
                    ((com.modulo.plugin.event.RemotePluginEvent) event).getOrigin())));
    }
}

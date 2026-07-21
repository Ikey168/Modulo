package com.modulo.plugin.event;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.modulo.entity.Note;
import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.Message;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * NATS bridge logic (#391): outbound republish, inbound injection, both
 * loop-protection layers, and degradation — against a mocked NATS
 * connection. The full broker round-trip runs in
 * {@code PluginEventBridgeNatsIT} (Docker-gated).
 */
@DisplayName("PluginEventBridge — bridging, loop protection, degradation")
class PluginEventBridgeTest {

    private PluginEventBus bus;
    private PluginEventBridge bridge;
    private Connection connection;
    private Dispatcher dispatcher;

    @BeforeEach
    void setUp() {
        bus = new PluginEventBus();
        connection = mock(Connection.class);
        dispatcher = mock(Dispatcher.class);
        when(connection.getStatus()).thenReturn(Connection.Status.CONNECTED);
        when(connection.createDispatcher(any())).thenReturn(dispatcher);

        bridge = new PluginEventBridge();
        ReflectionTestUtils.setField(bridge, "eventBus", bus);
        ReflectionTestUtils.setField(bridge, "brokerUrl", "nats://mock:4222");
        bridge.connectionFactory = () -> connection;
        bridge.start();
    }

    private static Note note(long id, String title) {
        Note n = new Note();
        n.setId(id);
        n.setTitle(title);
        return n;
    }

    @Test
    void locallyBornEventIsRepublishedToItsSubject() {
        bus.publish(new NoteEvent.NoteCreated(note(7, "hello")));

        ArgumentCaptor<byte[]> body = ArgumentCaptor.forClass(byte[].class);
        verify(connection).publish(eq("modulo.events.note.created"), body.capture());
        String json = new String(body.getValue(), StandardCharsets.UTF_8);
        assertThat(json).contains("\"type\":\"note.created\"").contains("\"origin\":\"core\"");
    }

    @Test
    void remoteEventsAreNeverRebridged() {
        bus.publish(new RemotePluginEvent("note.created", "plugin:someone", java.util.Map.of()));
        verify(connection, never()).publish(anyString(), any(byte[].class));
    }

    @Test
    void inboundMessageIsInjectedAsRemoteEvent() {
        List<PluginEvent> received = new CopyOnWriteArrayList<>();
        bus.subscribe("note.created", received::add);

        EventEnvelopeCodec.Envelope envelope = new EventEnvelopeCodec.Envelope(
            "id-1", "note.created", 1, "2026-07-21T00:00:00", "core",
            "{\"note\":{\"id\":9,\"title\":\"from-afar\"},\"metadata\":{\"k\":\"v\"}}");
        Message message = mock(Message.class);
        when(message.getData()).thenReturn(EventEnvelopeCodec.toJsonBytes(envelope));
        when(message.getSubject()).thenReturn("modulo.events.note.created");

        bridge.bridgeInbound(message);

        assertThat(received).hasSize(1);
        assertThat(received.get(0)).isInstanceOf(RemotePluginEvent.class);
        assertThat(received.get(0).getMetadata()).containsEntry("k", "v").containsKey("note");
    }

    @Test
    void injectedInboundEventIsNotRebridgedOutbound() {
        // Full loop: inbound → bus → outbound tap must drop it (layer 2).
        EventEnvelopeCodec.Envelope envelope = new EventEnvelopeCodec.Envelope(
            "id-2", "note.updated", 1, "2026-07-21T00:00:00", "core", "{}");
        Message message = mock(Message.class);
        when(message.getData()).thenReturn(EventEnvelopeCodec.toJsonBytes(envelope));
        when(message.getSubject()).thenReturn("modulo.events.note.updated");

        bridge.bridgeInbound(message);

        verify(connection, never()).publish(anyString(), any(byte[].class));
    }

    @Test
    void disconnectedBrokerSuspendsBridgingWithoutBreakingLocalPublish() {
        when(connection.getStatus()).thenReturn(Connection.Status.DISCONNECTED);
        List<PluginEvent> received = new CopyOnWriteArrayList<>();
        bus.subscribe("note.created", received::add);

        bus.publish(new NoteEvent.NoteCreated(note(1, "still-works")));

        assertThat(received).hasSize(1); // local delivery unaffected
        verify(connection, never()).publish(anyString(), any(byte[].class));
    }

    @Test
    void unreachableBrokerAtStartupDegradesInsteadOfFailing() {
        PluginEventBus freshBus = new PluginEventBus();
        PluginEventBridge degraded = new PluginEventBridge();
        ReflectionTestUtils.setField(degraded, "eventBus", freshBus);
        ReflectionTestUtils.setField(degraded, "brokerUrl", "nats://nowhere:4222");
        degraded.connectionFactory = () -> { throw new IllegalStateException("connection refused"); };

        degraded.start(); // must not throw

        List<PluginEvent> received = new CopyOnWriteArrayList<>();
        freshBus.subscribe("note.created", received::add);
        freshBus.publish(new NoteEvent.NoteCreated(note(2, "degraded")));
        assertThat(received).hasSize(1);
    }

    @Test
    void malformedInboundMessageIsDroppedQuietly() {
        Message message = mock(Message.class);
        when(message.getData()).thenReturn("not json".getBytes(StandardCharsets.UTF_8));
        when(message.getSubject()).thenReturn("modulo.events.junk");

        bridge.bridgeInbound(message); // must not throw
    }

    @Test
    void stopUnsubscribesTheTap() throws Exception {
        bridge.stop();
        bus.publish(new NoteEvent.NoteCreated(note(3, "after-stop")));
        verify(connection, never()).publish(anyString(), any(byte[].class));
    }
}

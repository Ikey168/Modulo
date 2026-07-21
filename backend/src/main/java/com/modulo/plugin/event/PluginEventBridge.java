package com.modulo.plugin.event;

import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.Nats;
import io.nats.client.Options;
import java.io.IOException;
import java.time.Duration;
import java.util.function.Supplier;
import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * NATS bridge for the in-JVM plugin event bus (#391, ADR 0004 §4).
 *
 * Outbound: every event born in this JVM is republished to
 * {@code modulo.events.<type>} using the shared wire envelope
 * ({@link EventEnvelopeCodec}). Inbound: broker messages are injected onto
 * the in-JVM bus as {@link RemotePluginEvent}s.
 *
 * Loop protection, two layers:
 *  - the NATS connection uses {@code noEcho}, so this instance never
 *    receives its own publishes;
 *  - only locally-born events are bridged — anything that is already a
 *    {@link RemotePluginEvent} (arrived via broker or via a plugin's gRPC
 *    PublishEvent) is never re-bridged.
 *
 * Degradation (ADR 0004 §5): the bean exists only when
 * {@code modulo.plugins.broker.enabled=true}; when on but NATS is
 * unreachable, connection is retried in the background (jnats reconnect)
 * and the in-JVM publish path is never blocked or failed — bridging is
 * silently skipped until the broker returns. Delivery is at-most-once.
 */
@Component
@ConditionalOnProperty(name = "modulo.plugins.broker.enabled", havingValue = "true")
public class PluginEventBridge {

    private static final Logger logger = LoggerFactory.getLogger(PluginEventBridge.class);

    public static final String SUBJECT_PREFIX = "modulo.events.";

    @Autowired private PluginEventBus eventBus;

    @Value("${modulo.plugins.broker.url:nats://nats:4222}")
    private String brokerUrl;

    /** Replaceable in tests — production supplies a real NATS connection. */
    Supplier<Connection> connectionFactory = this::connectToNats;

    private volatile Connection connection;
    private Dispatcher dispatcher;
    private final PluginEventListener<PluginEvent> outboundTap = this::bridgeOutbound;

    @PostConstruct
    void start() {
        try {
            connection = connectionFactory.get();
        } catch (Exception e) {
            logger.warn("NATS bridge enabled but broker unreachable at {} — degrading; "
                + "in-JVM events flow normally, bridging suspended: {}", brokerUrl, e.getMessage());
        }
        if (connection != null) {
            dispatcher = connection.createDispatcher(this::bridgeInbound);
            dispatcher.subscribe(SUBJECT_PREFIX + ">");
            logger.info("NATS bridge connected to {} (subjects {}>)", brokerUrl, SUBJECT_PREFIX);
        }
        // The tap is registered regardless: if the connection arrives later
        // (reconnect), events start flowing without re-wiring.
        eventBus.subscribeAll(outboundTap);
    }

    @PreDestroy
    void stop() {
        eventBus.unsubscribeAll(outboundTap);
        if (connection != null) {
            try {
                connection.close();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private Connection connectToNats() {
        try {
            Options options = new Options.Builder()
                .server(brokerUrl)
                .noEcho() // never receive our own publishes — loop-protection layer 1
                .maxReconnects(-1)
                .reconnectWait(Duration.ofSeconds(2))
                .connectionTimeout(Duration.ofSeconds(5))
                .build();
            return Nats.connect(options);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new IllegalStateException(e.getMessage(), e);
        }
    }

    /** Bus → NATS. Never throws — a broker problem must not break local publishing. */
    private void bridgeOutbound(PluginEvent event) {
        if (event instanceof RemotePluginEvent) {
            return; // arrived over a wire — loop-protection layer 2
        }
        Connection conn = this.connection;
        if (conn == null || conn.getStatus() != Connection.Status.CONNECTED) {
            logger.debug("NATS bridge degraded; dropping outbound {}", event.getType());
            return;
        }
        try {
            EventEnvelopeCodec.Envelope envelope =
                EventEnvelopeCodec.encode(event, EventEnvelopeCodec.ORIGIN_CORE);
            conn.publish(SUBJECT_PREFIX + event.getType(), EventEnvelopeCodec.toJsonBytes(envelope));
        } catch (Exception e) {
            logger.warn("Failed to bridge event {} to NATS: {}", event.getType(), e.getMessage());
        }
    }

    /** NATS → bus. Decodes the envelope and injects a RemotePluginEvent. */
    void bridgeInbound(io.nats.client.Message message) {
        try {
            EventEnvelopeCodec.Envelope envelope = EventEnvelopeCodec.fromJsonBytes(message.getData());
            if (envelope.type == null || envelope.type.isEmpty()) {
                logger.debug("Dropping NATS message on {} with no event type", message.getSubject());
                return;
            }
            eventBus.publish(EventEnvelopeCodec.decode(envelope));
        } catch (Exception e) {
            logger.warn("Failed to inject NATS message from {}: {}", message.getSubject(), e.getMessage());
        }
    }
}

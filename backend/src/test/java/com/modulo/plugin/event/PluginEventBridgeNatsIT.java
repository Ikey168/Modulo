package com.modulo.plugin.event;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;

import com.modulo.entity.Note;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Real-broker round-trip for the NATS bridge (#391): two bridged buses
 * (simulating two cores/pods) exchange events through an actual NATS
 * container, and nothing loops.
 *
 * Docker-gated: runs only with {@code -Dmodulo.docker.tests=true} (CI
 * runners with Docker; skipped in Docker-less environments). The bridge
 * logic itself is fully covered without Docker in PluginEventBridgeTest.
 */
@DisplayName("PluginEventBridge — real NATS round-trip")
@EnabledIfSystemProperty(named = "modulo.docker.tests", matches = "true")
class PluginEventBridgeNatsIT {

    private static GenericContainer<?> nats;

    @BeforeAll
    static void startBroker() {
        nats = new GenericContainer<>(DockerImageName.parse("nats:2.10-alpine"))
            .withExposedPorts(4222);
        nats.start();
    }

    @AfterAll
    static void stopBroker() {
        if (nats != null) nats.stop();
    }

    private static PluginEventBridge bridge(PluginEventBus bus) {
        PluginEventBridge bridge = new PluginEventBridge();
        ReflectionTestUtils.setField(bridge, "eventBus", bus);
        ReflectionTestUtils.setField(bridge, "brokerUrl",
            "nats://" + nats.getHost() + ":" + nats.getMappedPort(4222));
        bridge.start();
        return bridge;
    }

    @Test
    void eventCrossesTheBrokerBetweenTwoBusesAndDoesNotLoop() {
        PluginEventBus busA = new PluginEventBus();
        PluginEventBus busB = new PluginEventBus();
        PluginEventBridge bridgeA = bridge(busA);
        PluginEventBridge bridgeB = bridge(busB);
        try {
            List<PluginEvent> seenOnB = new CopyOnWriteArrayList<>();
            List<PluginEvent> seenOnA = new CopyOnWriteArrayList<>();
            busB.subscribe("note.created", seenOnB::add);
            busA.subscribe("note.created", seenOnA::add);

            Note note = new Note();
            note.setId(11L);
            note.setTitle("crossing");
            busA.publish(new NoteEvent.NoteCreated(note));

            await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(seenOnB).hasSize(1));
            assertThat(seenOnB.get(0)).isInstanceOf(RemotePluginEvent.class);

            // No echo back to A (noEcho + remote-event guard): A saw only its
            // own local delivery, and the count stays stable.
            assertThat(seenOnA).hasSize(1);
            try { Thread.sleep(1500); } catch (InterruptedException ignored) {}
            assertThat(seenOnA).hasSize(1);
            assertThat(seenOnB).hasSize(1);
        } finally {
            bridgeA.stop();
            bridgeB.stop();
        }
    }
}

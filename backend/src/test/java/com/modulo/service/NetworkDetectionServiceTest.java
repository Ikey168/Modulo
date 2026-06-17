package com.modulo.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Network Detection Service Tests")
class NetworkDetectionServiceTest {

    @Test
    void isOnlineDefaultsToFalse() {
        NetworkDetectionService service = new NetworkDetectionService();
        assertThat(service.isOnline()).isFalse();
    }

    @Test
    void reconnectedEventExposesSource() {
        NetworkDetectionService service = new NetworkDetectionService();
        NetworkDetectionService.NetworkReconnectedEvent event =
                new NetworkDetectionService.NetworkReconnectedEvent(service);
        assertThat(event.getSource()).isSameAs(service);
    }

    @Test
    void disconnectedEventExposesSource() {
        NetworkDetectionService service = new NetworkDetectionService();
        NetworkDetectionService.NetworkDisconnectedEvent event =
                new NetworkDetectionService.NetworkDisconnectedEvent(service);
        assertThat(event.getSource()).isSameAs(service);
    }
}

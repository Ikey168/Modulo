package com.modulo.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("IPFS Service Tests")
class IpfsServiceTest {

    private IpfsService service;

    @BeforeEach
    void setUp() {
        service = new IpfsService();
        ReflectionTestUtils.setField(service, "ipfsGatewayUrl", "http://gateway:8080");
        ReflectionTestUtils.setField(service, "ipfsNodeUrl", "http://node:5001");
    }

    @Test
    void calculateContentHashIsDeterministicSha256() {
        String h1 = service.calculateContentHash("Title", "Content");
        String h2 = service.calculateContentHash("Title", "Content");
        String h3 = service.calculateContentHash("Title", "Different");

        assertThat(h1).isEqualTo(h2);
        assertThat(h1).hasSize(64); // SHA-256 hex
        assertThat(h1).isNotEqualTo(h3);
    }

    @Test
    void gatewayUrlBuiltFromConfig() {
        assertThat(service.getGatewayUrl("QmAbc")).isEqualTo("http://gateway:8080/ipfs/QmAbc");
    }

    @Test
    void cidValidation() {
        assertThat(service.isValidCid(null)).isFalse();
        assertThat(service.isValidCid("  ")).isFalse();
        assertThat(service.isValidCid("Qm" + "x".repeat(44))).isTrue(); // v0, length 46
        assertThat(service.isValidCid("Qmshort")).isFalse();
        assertThat(service.isValidCid("b" + "x".repeat(55))).isTrue(); // v1
    }
}

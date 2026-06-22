package com.modulo.pack;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.service.IpfsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("PackIpfsService")
class PackIpfsServiceTest {

    @Mock IpfsService ipfsService;
    @Mock PackService packService;
    @Mock JdbcTemplate jdbc;

    @InjectMocks PackIpfsService service;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // Inject real ObjectMapper via reflection (InjectMocks won't pick it up)
        try {
            var field = PackIpfsService.class.getDeclaredField("objectMapper");
            field.setAccessible(true);
            field.set(service, mapper);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ---- publishToIpfs ----

    @Test
    void publishToIpfs_ipfsUnavailable_fails() {
        when(ipfsService.isAvailable()).thenReturn(false);
        var result = service.publishToIpfs("some.pack");
        assertThat(result.ok()).isFalse();
        assertThat(result.reason()).contains("not available");
    }

    @Test
    void publishToIpfs_packNotInstalled_fails() {
        when(ipfsService.isAvailable()).thenReturn(true);
        when(jdbc.queryForObject(anyString(), eq(String.class), any(), any()))
            .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));

        var result = service.publishToIpfs("missing.pack");
        assertThat(result.ok()).isFalse();
        assertThat(result.reason()).contains("not installed");
    }

    @Test
    void publishToIpfs_successPath_storesCidAndHash() throws Exception {
        String manifest = "{\"id\":\"test.pack\",\"version\":\"1.0.0\",\"name\":\"Test\"}";
        when(ipfsService.isAvailable()).thenReturn(true);
        when(jdbc.queryForObject(anyString(), eq(String.class), any(), any())).thenReturn(manifest);
        when(ipfsService.uploadEncryptedContent(manifest)).thenReturn("QmTestCid1234567890123456789012345678901234");
        when(ipfsService.pinContent(any())).thenReturn(true);
        when(ipfsService.getGatewayUrl(any())).thenReturn("http://localhost:8080/ipfs/QmTestCid1234567890123456789012345678901234");
        when(jdbc.update(anyString(), any(), any(), any(), any(), any())).thenReturn(1);

        var result = service.publishToIpfs("test.pack");
        assertThat(result.ok()).isTrue();
        assertThat(result.cid()).isEqualTo("QmTestCid1234567890123456789012345678901234");
        assertThat(result.contentHash()).hasSize(64); // SHA-256 hex
        assertThat(result.gatewayUrl()).contains("ipfs");
    }

    // ---- installFromCid ----

    @Test
    void installFromCid_ipfsUnavailable_fails() {
        when(ipfsService.isAvailable()).thenReturn(false);
        var result = service.installFromCid("QmTest1234567890123456789012345678901234567890", null);
        assertThat(result.ok()).isFalse();
    }

    @Test
    void installFromCid_invalidCid_fails() {
        when(ipfsService.isAvailable()).thenReturn(true);
        when(ipfsService.isValidCid("bad")).thenReturn(false);
        var result = service.installFromCid("bad", null);
        assertThat(result.ok()).isFalse();
        assertThat(result.reason()).contains("Invalid CID");
    }

    @Test
    void installFromCid_hashMismatch_fails() throws Exception {
        String cid = "QmTest1234567890123456789012345678901234567890";
        String content = "{\"id\":\"test\",\"version\":\"1.0.0\",\"name\":\"T\"}";
        when(ipfsService.isAvailable()).thenReturn(true);
        when(ipfsService.isValidCid(cid)).thenReturn(true);
        when(ipfsService.retrieveRawContent(cid)).thenReturn(content);

        var result = service.installFromCid(cid, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assertThat(result.ok()).isFalse();
        assertThat(result.reason()).contains("Integrity check failed");
    }

    @Test
    void installFromCid_validNoHash_installsDelegated() throws Exception {
        String cid = "QmTest1234567890123456789012345678901234567890";
        String content = "{\"id\":\"test.pack\",\"version\":\"1.0.0\",\"name\":\"Test Pack\",\"contributes\":{}}";
        when(ipfsService.isAvailable()).thenReturn(true);
        when(ipfsService.isValidCid(cid)).thenReturn(true);
        when(ipfsService.retrieveRawContent(cid)).thenReturn(content);
        when(packService.install(any())).thenReturn(PackService.PackCheck.pass());
        when(jdbc.update(anyString(), any(), any(), any(), any(), any())).thenReturn(1);

        var result = service.installFromCid(cid, null);
        assertThat(result.ok()).isTrue();
        verify(packService).install(any());
    }
}

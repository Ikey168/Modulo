package com.modulo.pack;

import com.modulo.config.BlockchainConfig;
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
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.tx.gas.StaticGasProvider;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("PackProvenanceService")
class PackProvenanceServiceTest {

    @Mock Web3j web3j;
    @Mock Credentials credentials;
    @Mock StaticGasProvider gasProvider;
    @Mock BlockchainConfig blockchainConfig;
    @Mock JdbcTemplate jdbc;
    @Mock PackService packService;

    @InjectMocks PackProvenanceService service;

    private PackEntry packWith(String hash, Boolean premium) {
        PackEntry e = new PackEntry();
        e.setPackId("test.pack");
        e.setName("Test Pack");
        e.setContentHash(hash);
        e.setPremium(premium);
        return e;
    }

    private static final String VALID_HASH =
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    @BeforeEach
    void setUp() {
        when(credentials.getAddress()).thenReturn("0xAUTHOR");
        // Default: chain not configured (offline / placeholder mode)
        when(blockchainConfig.getNoteMonetizationAddress()).thenReturn("");
    }

    // ---- toBytes32 ----

    @Test
    void toBytes32_validHash_returns32Bytes() {
        byte[] b = PackProvenanceService.toBytes32(VALID_HASH);
        assertThat(b).hasSize(32);
    }

    @Test
    void toBytes32_acceptsLeading0x() {
        byte[] b = PackProvenanceService.toBytes32("0x" + VALID_HASH);
        assertThat(b).hasSize(32);
    }

    @Test
    void toBytes32_wrongLength_throws() {
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
            () -> PackProvenanceService.toBytes32("deadbeef"));
    }

    // ---- anchorPack ----

    @Test
    void anchorPack_packNotInstalled_fails() {
        when(packService.getPack("missing")).thenReturn(Optional.empty());
        var result = service.anchorPack("missing");
        assertThat(result.ok()).isFalse();
        assertThat(result.reason()).contains("not installed");
    }

    @Test
    void anchorPack_noContentHash_fails() {
        when(packService.getPack("test.pack")).thenReturn(Optional.of(packWith(null, false)));
        var result = service.anchorPack("test.pack");
        assertThat(result.ok()).isFalse();
        assertThat(result.reason()).contains("content hash");
    }

    @Test
    void anchorPack_offlineMode_usesPlaceholderAndPersists() {
        when(packService.getPack("test.pack")).thenReturn(Optional.of(packWith(VALID_HASH, false)));
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        var result = service.anchorPack("test.pack");

        assertThat(result.ok()).isTrue();
        assertThat(result.placeholder()).isTrue();
        assertThat(result.txHash()).startsWith("0x");
        assertThat(result.authorAddress()).isEqualTo("0xAUTHOR");
        verify(jdbc).update(contains("UPDATE plugin_registry SET anchor_tx"),
            any(), any(), any(), any(), any(), any());
    }

    // ---- getProvenance ----

    @Test
    void getProvenance_notAnchored_returnsUnanchored() {
        when(packService.getPack("test.pack")).thenReturn(Optional.of(packWith(VALID_HASH, false)));
        var info = service.getProvenance("test.pack");
        assertThat(info).isPresent();
        assertThat(info.get().anchored()).isFalse();
    }

    @Test
    void getProvenance_packMissing_returnsEmpty() {
        when(packService.getPack("missing")).thenReturn(Optional.empty());
        assertThat(service.getProvenance("missing")).isEmpty();
    }

    @Test
    void getProvenance_anchored_returnsInfo() {
        PackEntry p = packWith(VALID_HASH, false);
        p.setAnchorTx("0xTX");
        p.setAuthorAddress("0xAUTHOR");
        when(packService.getPack("test.pack")).thenReturn(Optional.of(p));
        var info = service.getProvenance("test.pack");
        assertThat(info).isPresent();
        assertThat(info.get().anchored()).isTrue();
        assertThat(info.get().txHash()).isEqualTo("0xTX");
    }

    // ---- hasEntitlement ----

    @Test
    void hasEntitlement_freePack_alwaysTrue() {
        assertThat(service.hasEntitlement(packWith(VALID_HASH, false), null)).isTrue();
        assertThat(service.hasEntitlement(packWith(VALID_HASH, false), "0xBUYER")).isTrue();
    }

    @Test
    void hasEntitlement_premiumNoAddress_false() {
        assertThat(service.hasEntitlement(packWith(VALID_HASH, true), null)).isFalse();
    }

    @Test
    void hasEntitlement_premiumAuthor_true() {
        PackEntry p = packWith(VALID_HASH, true);
        p.setAuthorAddress("0xAUTHOR");
        assertThat(service.hasEntitlement(p, "0xAUTHOR")).isTrue();
    }

    @Test
    void hasEntitlement_premiumOfflineNonAuthor_false() {
        PackEntry p = packWith(VALID_HASH, true);
        p.setAuthorAddress("0xAUTHOR");
        p.setOnchainId(1L);
        // chain unavailable (default), buyer is not author -> cannot verify -> false
        assertThat(service.hasEntitlement(p, "0xBUYER")).isFalse();
    }
}

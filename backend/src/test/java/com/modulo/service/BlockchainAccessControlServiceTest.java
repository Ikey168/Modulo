package com.modulo.service;

import com.modulo.config.BlockchainConfig;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.ExecutionException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;

/**
 * Tests the blockchain-unavailable (placeholder) code paths of
 * {@link BlockchainAccessControlService}; the actual on-chain interactions
 * require a live web3j connection and are not exercised here.
 */
@DisplayName("Blockchain Access Control Service Tests")
class BlockchainAccessControlServiceTest {

    private BlockchainAccessControlService service;

    @BeforeEach
    void setUp() {
        BlockchainConfig config = mock(BlockchainConfig.class);
        // null registry address -> isBlockchainAvailable() == false -> placeholder paths
        lenient().when(config.getNoteRegistryAddress()).thenReturn(null);
        NoteRepository noteRepository = mock(NoteRepository.class);
        lenient().when(noteRepository.findById(any())).thenReturn(java.util.Optional.of(new com.modulo.entity.Note("t", "c")));
        service = new BlockchainAccessControlService(config, noteRepository);
    }

    @Test
    void grantPermissionUsesPlaceholder() throws Exception {
        Map<String, Object> result = service.grantPermission(
                1L, "0xgrantee", BlockchainAccessControlService.Permission.READ, "0xgranter").get();
        assertThat(result).isNotNull();
    }

    @Test
    void revokePermissionUsesPlaceholder() throws Exception {
        Map<String, Object> result = service.revokePermission(
                1L, "0xgrantee", "0xrevoker").get();
        assertThat(result).isNotNull();
    }

    @Test
    void checkPermissionUsesPlaceholder() throws Exception {
        Map<String, Object> result = service.checkPermission(1L, "0xuser").get();
        assertThat(result).isNotNull();
    }

    @Test
    void setNoteVisibilityUsesPlaceholder() throws Exception {
        Map<String, Object> result = service.setNoteVisibility(1L, true, "0xowner").get();
        assertThat(result).isNotNull();
    }

    @Test
    void getNoteCollaboratorsUsesPlaceholder() throws Exception {
        Map<String, Object> result = service.getNoteCollaborators(1L, "0xrequester").get();
        assertThat(result).isNotNull();
    }

    @Test
    void enableAccessControlUsesPlaceholder() throws Exception {
        Map<String, Object> result = service.enableAccessControl(1L, "0xowner").get();
        assertThat(result).isNotNull();
    }
}

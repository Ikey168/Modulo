package com.modulo.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.service.BlockchainService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for BlockchainController
 */
@WebMvcTest(BlockchainController.class)
class BlockchainControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BlockchainService blockchainService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser
    void testGetNetworkStatus_Success() throws Exception {
        // Given
        var networkInfo = BlockchainService.NetworkInfo.builder()
                .connected(true)
                .networkName("mumbai")
                .chainId(80001L)
                .blockNumber(12345L)
                .gasPrice("20000000000")
                .build();

        when(blockchainService.getNetworkInfo()).thenReturn(networkInfo);

        // When & Then
        mockMvc.perform(get("/api/blockchain/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.networkName").value("mumbai"))
                .andExpect(jsonPath("$.chainId").value(80001));
    }

    @Test
    @WithMockUser
    void testGetNetworkStatus_Disconnected() throws Exception {
        // Given
        var networkInfo = BlockchainService.NetworkInfo.builder()
                .connected(false)
                .build();

        when(blockchainService.getNetworkInfo()).thenReturn(networkInfo);

        // When & Then
        mockMvc.perform(get("/api/blockchain/status"))
                .andExpect(status().isServiceUnavailable())
                .andExpected(jsonPath("$.connected").value(false))
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    @WithMockUser
    void testRegisterNote_Success() throws Exception {
        // Given
        when(blockchainService.isAvailable()).thenReturn(true);
        
        var result = BlockchainService.TransactionResult.builder()
                .success(true)
                .noteId(123L)
                .transactionHash("0x1234567890abcdef")
                .build();

        when(blockchainService.registerNote(anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(result));

        var request = Map.of(
                "content", "Test note content",
                "title", "Test Note Title"
        );

        // When & Then
        mockMvc.perform(post("/api/blockchain/notes/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.noteId").value(123))
                .andExpect(jsonPath("$.transactionHash").value("0x1234567890abcdef"));
    }

    @Test
    @WithMockUser
    void testRegisterNote_ServiceUnavailable() throws Exception {
        // Given
        when(blockchainService.isAvailable()).thenReturn(false);

        var request = Map.of(
                "content", "Test note content",
                "title", "Test Note Title"
        );

        // When & Then
        mockMvc.perform(post("/api/blockchain/notes/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("Blockchain service unavailable"));
    }

    @Test
    @WithMockUser
    void testRegisterNote_ValidationError() throws Exception {
        // Given
        when(blockchainService.isAvailable()).thenReturn(true);

        var request = Map.of(
                "content", "", // Empty content should fail validation
                "title", "Test Note Title"
        );

        // When & Then
        mockMvc.perform(post("/api/blockchain/notes/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void testVerifyNote_Success() throws Exception {
        // Given
        when(blockchainService.isAvailable()).thenReturn(true);
        
        var result = BlockchainService.VerificationResult.builder()
                .exists(true)
                .noteId(123L)
                .owner("0x1234567890abcdef")
                .timestamp(System.currentTimeMillis())
                .build();

        when(blockchainService.verifyNote(anyString()))
                .thenReturn(CompletableFuture.completedFuture(result));

        var request = Map.of("content", "Test note content");

        // When & Then
        mockMvc.perform(post("/api/blockchain/notes/verify")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exists").value(true))
                .andExpect(jsonPath("$.noteId").value(123))
                .andExpect(jsonPath("$.owner").value("0x1234567890abcdef"));
    }

    @Test
    @WithMockUser
    void testGetNoteById_Success() throws Exception {
        // Given
        when(blockchainService.isAvailable()).thenReturn(true);
        
        var note = BlockchainService.NoteDetails.builder()
                .id(123L)
                .contentHash("0xabcdef")
                .title("Test Note")
                .owner("0x1234567890abcdef")
                .timestamp(System.currentTimeMillis())
                .build();

        when(blockchainService.getNoteById(123L))
                .thenReturn(CompletableFuture.completedFuture(Optional.of(note)));

        // When & Then
        mockMvc.perform(get("/api/blockchain/notes/123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(123))
                .andExpect(jsonPath("$.title").value("Test Note"))
                .andExpect(jsonPath("$.owner").value("0x1234567890abcdef"));
    }

    @Test
    @WithMockUser
    void testGetNoteById_NotFound() throws Exception {
        // Given
        when(blockchainService.isAvailable()).thenReturn(true);
        when(blockchainService.getNoteById(999L))
                .thenReturn(CompletableFuture.completedFuture(Optional.empty()));

        // When & Then
        mockMvc.perform(get("/api/blockchain/notes/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void testGetMyNotes_Success() throws Exception {
        // Given
        when(blockchainService.isAvailable()).thenReturn(true);
        when(blockchainService.getMyNotes())
                .thenReturn(CompletableFuture.completedFuture(Arrays.asList(1L, 2L, 3L)));

        // When & Then
        mockMvc.perform(get("/api/blockchain/notes/my-notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noteIds").isArray())
                .andExpect(jsonPath("$.noteIds.length()").value(3))
                .andExpected(jsonPath("$.count").value(3));
    }

    @Test
    @WithMockUser
    void testGetTotalNoteCount_Success() throws Exception {
        // Given
        when(blockchainService.isAvailable()).thenReturn(true);
        when(blockchainService.getTotalNoteCount())
                .thenReturn(CompletableFuture.completedFuture(42L));

        // When & Then
        mockMvc.perform(get("/api/blockchain/notes/count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalNotes").value(42));
    }

    @Test
    @WithMockUser
    void testGenerateHash_Success() throws Exception {
        // Given
        when(blockchainService.generateNoteHash("test content"))
                .thenReturn("0x1234567890abcdef");

        var request = Map.of("content", "test content");

        // When & Then
        mockMvc.perform(post("/api/blockchain/hash")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("test content"))
                .andExpect(jsonPath("$.hash").value("0x1234567890abcdef"));
    }

    @Test
    void testEndpointsRequireAuthentication() throws Exception {
        // Test that endpoints require authentication
        mockMvc.perform(get("/api/blockchain/status"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/blockchain/notes/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }
}

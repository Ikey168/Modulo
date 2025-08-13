package com.modulo.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.service.BlockchainService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Map;
import java.util.List;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Unit tests for BlockchainController
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
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
        Map<String, Object> networkStatus = new HashMap<>();
        networkStatus.put("connected", true);
        networkStatus.put("networkId", 80001L);
        networkStatus.put("latestBlock", 12345L);
        networkStatus.put("gasPrice", "20000000000");

        when(blockchainService.getNetworkStatus()).thenReturn(CompletableFuture.completedFuture(networkStatus));

        // When & Then
        MvcResult mvcResult = mockMvc.perform(get("/api/blockchain/status"))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(mvcResult))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.networkId").value(80001));
    }

    @Test
    @WithMockUser
    void testGetNetworkStatus_Disconnected() throws Exception {
        // Given
        Map<String, Object> networkStatus = new HashMap<>();
        networkStatus.put("connected", false);

        when(blockchainService.getNetworkStatus()).thenReturn(CompletableFuture.completedFuture(networkStatus));

        // When & Then
        MvcResult mvcResult = mockMvc.perform(get("/api/blockchain/status"))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(mvcResult))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(false));
    }

    @Test
    @WithMockUser
    void testRegisterNote_Success() throws Exception {
        // Given
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("noteId", 123L);
        result.put("transactionHash", "0x1234567890abcdef");
        result.put("contentHash", "0xabcd1234");

        when(blockchainService.registerNote(anyString(), anyString(), anyString()))
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
    void testRegisterNote_ValidationError() throws Exception {
        // Given
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
        Map<String, Object> result = new HashMap<>();
        result.put("exists", true);
        result.put("owner", "testuser");
        result.put("contentHash", "0xabcd1234");
        result.put("verified", true);

        when(blockchainService.verifyNote(anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(result));

        var request = Map.of("content", "Test note content");

        // When & Then
        mockMvc.perform(post("/api/blockchain/notes/verify")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exists").value(true))
                .andExpect(jsonPath("$.owner").value("testuser"));
    }

    @Test
    @WithMockUser
    void testGetNoteById_Success() throws Exception {
        // Given
        Map<String, Object> note = new HashMap<>();
        note.put("noteId", 123L);
        note.put("owner", "testuser");
        note.put("contentHash", "0xabcdef");
        note.put("timestamp", System.currentTimeMillis());

        when(blockchainService.getNoteById(eq(123L), anyString()))
                .thenReturn(CompletableFuture.completedFuture(note));

        // When & Then
        mockMvc.perform(get("/api/blockchain/notes/123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noteId").value(123))
                .andExpect(jsonPath("$.owner").value("testuser"));
    }

    @Test
    @WithMockUser
    void testGetNoteById_NotFound() throws Exception {
        // Given
        Map<String, Object> emptyResult = new HashMap<>();
        when(blockchainService.getNoteById(eq(999L), anyString()))
                .thenReturn(CompletableFuture.completedFuture(emptyResult));

        // When & Then
        mockMvc.perform(get("/api/blockchain/notes/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void testGetMyNotes_Success() throws Exception {
        // Given
        List<Map<String, Object>> notes = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            Map<String, Object> note = new HashMap<>();
            note.put("noteId", (long) i);
            note.put("owner", "testuser");
            note.put("contentHash", "0x" + i);
            notes.add(note);
        }

        when(blockchainService.getUserNotes(anyString()))
                .thenReturn(CompletableFuture.completedFuture(notes));

        // When & Then
        mockMvc.perform(get("/api/blockchain/notes/my-notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    @WithMockUser
    void testGetTotalNoteCount_Success() throws Exception {
        // Given
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
        when(blockchainService.generateContentHash("test content"))
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

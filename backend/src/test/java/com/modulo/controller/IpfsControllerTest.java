package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import com.modulo.service.IpfsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class IpfsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IpfsService ipfsService;
    @MockBean
    private NoteRepository noteRepository;

    private Note note;

    @BeforeEach
    void setUp() {
        note = new Note("Title", "Content");
        note.setId(1L);
    }

    @Test
    void uploadNoteToIpfs() throws Exception {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));
        when(ipfsService.uploadNoteToIpfs(any(Note.class))).thenReturn("cid-123");
        when(ipfsService.getGatewayUrl("cid-123")).thenReturn("https://ipfs/cid-123");

        mockMvc.perform(post("/api/ipfs/notes/1/upload").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void uploadNoteNotFound() throws Exception {
        when(noteRepository.findById(9L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/ipfs/notes/9/upload").with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    void getContentFromIpfs() throws Exception {
        when(ipfsService.retrieveContentFromIpfs("cid-123")).thenReturn("hello");

        mockMvc.perform(get("/api/ipfs/content/cid-123"))
                .andExpect(status().isOk());
    }

    @Test
    void verifyNoteIntegrity() throws Exception {
        note.setIpfsCid("cid-123");
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));
        when(ipfsService.verifyNoteIntegrity(any(Note.class))).thenReturn(true);

        mockMvc.perform(post("/api/ipfs/notes/1/verify").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void verifyNoteNotFound() throws Exception {
        when(noteRepository.findById(9L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/ipfs/notes/9/verify").with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    void getIpfsStatus() throws Exception {
        when(ipfsService.getNodeStatus()).thenReturn(Map.of("online", true));

        mockMvc.perform(get("/api/ipfs/status"))
                .andExpect(status().isOk());
    }

    @Test
    void getDecentralizedNotes() throws Exception {
        when(ipfsService.getDecentralizedNotes(anyInt(), anyInt())).thenReturn(Map.of("notes", "[]"));

        mockMvc.perform(get("/api/ipfs/notes"))
                .andExpect(status().isOk());
    }
}

package com.modulo.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import com.modulo.service.ConflictResolutionService;
import com.modulo.service.IpfsService;
import com.modulo.service.OfflineSyncService;
import com.modulo.service.TagService;
import com.modulo.service.WebSocketNotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class NoteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NoteRepository noteRepository;
    @MockBean
    private TagService tagService;
    @MockBean
    private WebSocketNotificationService webSocketNotificationService;
    @MockBean
    private ConflictResolutionService conflictResolutionService;
    @MockBean
    private OfflineSyncService offlineSyncService;
    @MockBean
    private IpfsService ipfsService;

    private Note note;

    @BeforeEach
    void setUp() {
        note = new Note("Title", "Content");
        note.setId(1L);
    }

    @Test
    void getAllNotes() throws Exception {
        when(noteRepository.findAllWithTags()).thenReturn(List.of(note));

        mockMvc.perform(get("/api/notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Title"));
    }

    @Test
    void getNoteByIdFound() throws Exception {
        when(noteRepository.findByIdWithTags(1L)).thenReturn(Optional.of(note));

        mockMvc.perform(get("/api/notes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void getNoteByIdNotFound() throws Exception {
        when(noteRepository.findByIdWithTags(2L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/notes/2"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createNote() throws Exception {
        when(noteRepository.save(any(Note.class))).thenAnswer(inv -> {
            Note n = inv.getArgument(0);
            n.setId(5L);
            return n;
        });
        Map<String, Object> body = Map.of(
                "title", "New",
                "content", "Body",
                "markdownContent", "# Body");

        mockMvc.perform(post("/api/notes").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("New"));

        verify(noteRepository).save(any(Note.class));
    }

    @Test
    void deleteNoteSuccess() throws Exception {
        when(noteRepository.existsById(1L)).thenReturn(true);

        mockMvc.perform(delete("/api/notes/1").with(csrf()))
                .andExpect(status().isNoContent());

        verify(noteRepository).deleteById(1L);
    }

    @Test
    void deleteNoteNotFound() throws Exception {
        when(noteRepository.existsById(9L)).thenReturn(false);

        mockMvc.perform(delete("/api/notes/9").with(csrf()))
                .andExpect(status().isNotFound());

        verify(noteRepository, never()).deleteById(anyLong());
    }

    @Test
    void getNotesByTag() throws Exception {
        when(noteRepository.findByTagName("work")).thenReturn(List.of(note));

        mockMvc.perform(get("/api/notes/tag/work"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Title"));
    }

    @Test
    void searchNotes() throws Exception {
        when(noteRepository.findByTitleOrContentContainingIgnoreCase("query")).thenReturn(List.of(note));

        mockMvc.perform(get("/api/notes/search").param("query", "query"))
                .andExpect(status().isOk());
    }
}

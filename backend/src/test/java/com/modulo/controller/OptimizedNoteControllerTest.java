package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.service.OptimizedNoteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class OptimizedNoteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OptimizedNoteService noteService;

    private Note note;

    @BeforeEach
    void setUp() {
        note = new Note("Title", "Content");
        note.setId(1L);
    }

    @Test
    void getNoteByIdFound() throws Exception {
        when(noteService.findById(1L)).thenReturn(Optional.of(note));

        mockMvc.perform(get("/api/v2/notes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void getNoteByIdNotFound() throws Exception {
        when(noteService.findById(2L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v2/notes/2"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getUserNotes() throws Exception {
        Page<Note> page = new PageImpl<>(List.of(note));
        when(noteService.findByUserId(eq(100L), anyInt(), anyInt(), anyString())).thenReturn(page);

        mockMvc.perform(get("/api/v2/notes/user/100"))
                .andExpect(status().isOk());
    }

    @Test
    void getRecentlyAccessed() throws Exception {
        when(noteService.findRecentlyAccessedByUser(100L)).thenReturn(List.of(note));

        mockMvc.perform(get("/api/v2/notes/user/100/recent"))
                .andExpect(status().isOk());
    }

    @Test
    void search() throws Exception {
        when(noteService.searchNotes(eq("q"), anyInt(), anyInt())).thenReturn(new PageImpl<>(List.of(note)));

        mockMvc.perform(get("/api/v2/notes/search").param("q", "q"))
                .andExpect(status().isOk());
    }

    @Test
    void advancedSearch() throws Exception {
        when(noteService.advancedSearch(any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(new PageImpl<>(List.of(note)));

        mockMvc.perform(get("/api/v2/notes/search/advanced").param("q", "q"))
                .andExpect(status().isOk());
    }

    @Test
    void getNotesByTag() throws Exception {
        when(noteService.findByTag(eq("work"), anyInt(), anyInt())).thenReturn(new PageImpl<>(List.of(note)));

        mockMvc.perform(get("/api/v2/notes/tag/work"))
                .andExpect(status().isOk());
    }

    @Test
    void getUserStatistics() throws Exception {
        when(noteService.getUserNoteStatistics(100L)).thenReturn(Map.of("totalNotes", 3L));

        mockMvc.perform(get("/api/v2/notes/user/100/stats"))
                .andExpect(status().isOk());
    }

    @Test
    void getUserNoteCount() throws Exception {
        when(noteService.getNoteCountByUser(100L)).thenReturn(7L);

        mockMvc.perform(get("/api/v2/notes/user/100/count"))
                .andExpect(status().isOk());
    }

    @Test
    void getRecentlyUpdated() throws Exception {
        when(noteService.getRecentlyUpdatedNotes(eq(100L), anyInt())).thenReturn(List.of(note));

        mockMvc.perform(get("/api/v2/notes/recent").param("userId", "100"))
                .andExpect(status().isOk());
    }

    @Test
    void getNoteTitles() throws Exception {
        when(noteService.getNoteTitles(eq(100L), anyInt()))
                .thenReturn(List.of(Map.of("id", 1L, "title", "Title")));

        mockMvc.perform(get("/api/v2/notes/titles").param("userId", "100"))
                .andExpect(status().isOk());
    }

    @Test
    void warmUpCache() throws Exception {
        mockMvc.perform(post("/api/v2/notes/user/100/cache/warmup").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void clearUserCache() throws Exception {
        mockMvc.perform(delete("/api/v2/notes/user/100/cache").with(csrf()))
                .andExpect(status().isOk());
    }
}

package com.modulo.controller;

import com.modulo.entity.Tag;
import com.modulo.service.TagService;
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
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class TagControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TagService tagService;

    private Tag tag;
    private UUID id;

    @BeforeEach
    void setUp() {
        id = UUID.randomUUID();
        tag = new Tag("work");
        tag.setId(id);
    }

    @Test
    void getAllTags() throws Exception {
        when(tagService.findAll()).thenReturn(List.of(tag));

        mockMvc.perform(get("/api/tags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("work"));
    }

    @Test
    void getTagByIdFound() throws Exception {
        when(tagService.findById(id)).thenReturn(Optional.of(tag));

        mockMvc.perform(get("/api/tags/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("work"));
    }

    @Test
    void getTagByIdNotFound() throws Exception {
        when(tagService.findById(id)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/tags/" + id))
                .andExpect(status().isNotFound());
    }

    @Test
    void searchTags() throws Exception {
        when(tagService.searchByName("wo")).thenReturn(List.of(tag));

        mockMvc.perform(get("/api/tags/search").param("query", "wo"))
                .andExpect(status().isOk());
    }

    @Test
    void createTag() throws Exception {
        when(tagService.createOrGetTag("work")).thenReturn(tag);

        mockMvc.perform(post("/api/tags").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"work\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("work"));
    }

    @Test
    void createTagRejectsEmptyName() throws Exception {
        mockMvc.perform(post("/api/tags").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest());

        verify(tagService, never()).createOrGetTag(anyString());
    }

    @Test
    void deleteTagFound() throws Exception {
        when(tagService.findById(id)).thenReturn(Optional.of(tag));

        mockMvc.perform(delete("/api/tags/" + id).with(csrf()))
                .andExpect(status().isNoContent());

        verify(tagService).deleteById(id);
    }

    @Test
    void deleteTagNotFound() throws Exception {
        when(tagService.findById(id)).thenReturn(Optional.empty());

        mockMvc.perform(delete("/api/tags/" + id).with(csrf()))
                .andExpect(status().isNotFound());

        verify(tagService, never()).deleteById(any());
    }

    @Test
    void getTagsByNote() throws Exception {
        when(tagService.findTagsByNoteId(5L)).thenReturn(List.of(tag));

        mockMvc.perform(get("/api/tags/note/5"))
                .andExpect(status().isOk());
    }

    @Test
    void getTagCount() throws Exception {
        when(tagService.countNotesByTagId(id)).thenReturn(4L);

        mockMvc.perform(get("/api/tags/" + id + "/count"))
                .andExpect(status().isOk());
    }
}

package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.repository.NoteRepository;
import com.modulo.repository.NoteLinkRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

@SpringBootTest
@AutoConfigureMockMvc
public class NoteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NoteRepository noteRepository;

    @MockBean
    private NoteLinkRepository noteLinkRepository;

    @Test
    public void createNote_ShouldReturnCreatedNote() throws Exception {
        Note note = new Note("Test Title", "Test Content");
        when(noteRepository.save(any(Note.class))).thenReturn(note);

        mockMvc.perform(post("/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Test Title\", \"content\":\"Test Content\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Test Title"))
                .andExpect(jsonPath("$.content").value("Test Content"));
    }

    @Test
    public void createLink_ShouldReturnSuccessMessage() throws Exception {
        Note source = new Note("Source Note", "Source Content");
        Note target = new Note("Target Note", "Target Content");

        when(noteRepository.findById(1L)).thenReturn(Optional.of(source));
        when(noteRepository.findById(2L)).thenReturn(Optional.of(target));
        when(noteLinkRepository.save(any(NoteLink.class))).thenReturn(null);

        mockMvc.perform(post("/notes/1/links/2?type=RELATED"))
                .andExpect(status().isCreated())
                .andExpect(content().string("Link created successfully"));
    }

    @Test
    public void getAllNotes_ShouldReturnListOfNotes() throws Exception {
        Note note1 = new Note("Test Title 1", "Test Content 1");
        Note note2 = new Note("Test Title 2", "Test Content 2");
        when(noteRepository.findAll()).thenReturn(Arrays.asList(note1, note2));

        mockMvc.perform(get("/notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Test Title 1"))
                .andExpect(jsonPath("$[1].title").value("Test Title 2"));
    }
}
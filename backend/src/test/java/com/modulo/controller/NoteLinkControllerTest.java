package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.service.NoteLinkService;
import com.modulo.service.WebSocketNotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class NoteLinkControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NoteLinkService noteLinkService;
    @MockBean
    private WebSocketNotificationService webSocketNotificationService;

    private NoteLink link;
    private UUID linkId;

    @BeforeEach
    void setUp() {
        Note a = new Note("a", "a");
        Note b = new Note("b", "b");
        link = new NoteLink(a, b, "REFERENCES");
        linkId = UUID.randomUUID();
        link.setId(linkId);
    }

    @Test
    void getLinksForNote() throws Exception {
        when(noteLinkService.getLinksForNote(1L)).thenReturn(List.of(link));

        mockMvc.perform(get("/api/note-links/note/1"))
                .andExpect(status().isOk());
    }

    @Test
    void getOutgoingLinks() throws Exception {
        when(noteLinkService.getOutgoingLinks(1L)).thenReturn(List.of(link));

        mockMvc.perform(get("/api/note-links/note/1/outgoing"))
                .andExpect(status().isOk());
    }

    @Test
    void getIncomingLinks() throws Exception {
        when(noteLinkService.getIncomingLinks(1L)).thenReturn(List.of(link));

        mockMvc.perform(get("/api/note-links/note/1/incoming"))
                .andExpect(status().isOk());
    }

    @Test
    void getLinksByType() throws Exception {
        when(noteLinkService.getLinksByType("REFERENCES")).thenReturn(List.of(link));

        mockMvc.perform(get("/api/note-links/type/REFERENCES"))
                .andExpect(status().isOk());
    }

    @Test
    void getAllLinks() throws Exception {
        when(noteLinkService.getAllLinks()).thenReturn(List.of(link));

        mockMvc.perform(get("/api/note-links"))
                .andExpect(status().isOk());
    }

    @Test
    void getLinkByIdFound() throws Exception {
        when(noteLinkService.findById(linkId)).thenReturn(Optional.of(link));

        mockMvc.perform(get("/api/note-links/" + linkId))
                .andExpect(status().isOk());
    }

    @Test
    void getLinkByIdNotFound() throws Exception {
        when(noteLinkService.findById(linkId)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/note-links/" + linkId))
                .andExpect(status().isNotFound());
    }
}

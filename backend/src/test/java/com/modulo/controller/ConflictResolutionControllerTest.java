package com.modulo.controller;

import com.modulo.dto.ConflictResolutionDto;
import com.modulo.entity.Note;
import com.modulo.service.ConflictResolutionService;
import com.modulo.service.WebSocketNotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class ConflictResolutionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ConflictResolutionService conflictResolutionService;
    @MockBean
    private WebSocketNotificationService webSocketNotificationService;

    private static final String CHECK_BODY = "{\"noteId\":1,\"expectedVersion\":2,\"title\":\"T\"," +
            "\"content\":\"C\",\"markdownContent\":\"# C\",\"tagNames\":[\"a\"],\"editor\":\"bob\"}";

    @Test
    void checkConflictsOk() throws Exception {
        ConflictResolutionDto dto = new ConflictResolutionDto();
        dto.setNoteId(1L);
        when(conflictResolutionService.checkForConflicts(anyLong(), anyLong(), any(), any(), any(), any()))
                .thenReturn(dto);

        mockMvc.perform(post("/api/conflicts/check").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(CHECK_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noteId").value(1));
    }

    @Test
    void checkConflictsNotFound() throws Exception {
        when(conflictResolutionService.checkForConflicts(anyLong(), anyLong(), any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Note not found"));

        mockMvc.perform(post("/api/conflicts/check").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(CHECK_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateWithConflictCheckOk() throws Exception {
        Note note = new Note("T", "C");
        note.setId(1L);
        when(conflictResolutionService.updateNoteWithConflictCheck(
                anyLong(), anyLong(), any(), any(), any(), anyList(), any())).thenReturn(note);

        mockMvc.perform(put("/api/conflicts/update").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(CHECK_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("T"));
    }

    @Test
    void updateReturnsConflictOnVersionMismatch() throws Exception {
        when(conflictResolutionService.updateNoteWithConflictCheck(
                anyLong(), anyLong(), any(), any(), any(), anyList(), any()))
                .thenThrow(new ObjectOptimisticLockingFailureException(Note.class, 1L));
        ConflictResolutionDto dto = new ConflictResolutionDto();
        dto.setNoteId(1L);
        when(conflictResolutionService.checkForConflicts(anyLong(), anyLong(), any(), any(), any(), any()))
                .thenReturn(dto);

        mockMvc.perform(put("/api/conflicts/update").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(CHECK_BODY))
                .andExpect(status().isConflict());
    }
}

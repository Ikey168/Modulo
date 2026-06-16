package com.modulo.controller;

import com.modulo.dto.AttachmentDto;
import com.modulo.dto.AttachmentUploadResponse;
import com.modulo.service.AttachmentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
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
class AttachmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AttachmentService attachmentService;

    @Test
    void uploadAttachment() throws Exception {
        AttachmentUploadResponse resp = AttachmentUploadResponse.builder()
                .attachmentId(1L).originalFilename("f.pdf").success(true).build();
        when(attachmentService.uploadAttachment(any(), eq(5L), anyString())).thenReturn(resp);

        MockMultipartFile file = new MockMultipartFile("file", "f.pdf",
                "application/pdf", "data".getBytes());

        mockMvc.perform(multipart("/api/attachments/upload").file(file)
                        .param("noteId", "5").param("uploadedBy", "user").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void getAttachmentsByNote() throws Exception {
        AttachmentDto dto = AttachmentDto.builder().id(1L).originalFilename("f.pdf").build();
        when(attachmentService.getAttachmentsByNoteId(5L)).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/attachments/note/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    void getAttachmentById() throws Exception {
        AttachmentDto dto = AttachmentDto.builder().id(1L).originalFilename("f.pdf").build();
        when(attachmentService.getAttachmentById(1L)).thenReturn(dto);

        mockMvc.perform(get("/api/attachments/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void getDownloadUrl() throws Exception {
        when(attachmentService.getDownloadUrl(1L)).thenReturn("https://cdn/x.pdf");

        mockMvc.perform(get("/api/attachments/1/download-url"))
                .andExpect(status().isOk());
    }

    @Test
    void deleteAttachment() throws Exception {
        when(attachmentService.deleteAttachment(eq(1L), anyString())).thenReturn(true);

        mockMvc.perform(delete("/api/attachments/1").param("deletedBy", "user").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void hardDeleteAttachment() throws Exception {
        when(attachmentService.hardDeleteAttachment(eq(1L), anyString())).thenReturn(true);

        mockMvc.perform(delete("/api/attachments/1/hard").param("deletedBy", "user").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void ensureContainer() throws Exception {
        mockMvc.perform(post("/api/attachments/container/ensure").with(csrf()))
                .andExpect(status().isOk());
    }
}

package com.modulo.security;

import com.azure.storage.blob.BlobServiceClient;
import com.modulo.entity.*;
import com.modulo.repository.*;
import com.modulo.service.AttachmentService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockMultipartFile;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AttachmentOwnershipTest {
    @Test void anotherOwnerCannotReadDeleteDownloadOrUploadToANote() {
        var http = mock(com.azure.core.http.HttpClient.class);
        var blobs = new com.azure.storage.blob.BlobServiceClientBuilder().endpoint("https://example.invalid").httpClient(http).buildClient(); var attachments = mock(AttachmentRepository.class); var notes = mock(NoteRepository.class);
        var users = mock(AuthenticatedUserService.class); when(users.requireUserId()).thenReturn(1L); when(users.actor()).thenReturn("1");
        var service = new AttachmentService(blobs, attachments, notes); ReflectionTestUtils.setField(service, "users", users);
        assertThrows(ResponseStatusException.class, () -> service.getAttachmentById(20L));
        assertThrows(ResponseStatusException.class, () -> service.getDownloadUrl(20L));
        assertThrows(ResponseStatusException.class, () -> service.deleteAttachment(20L, "2"));
        assertThrows(ResponseStatusException.class, () -> service.hardDeleteAttachment(20L, "2"));
        assertThrows(ResponseStatusException.class, () -> service.getAttachmentsByNoteId(202L));
        assertThrows(ResponseStatusException.class, () -> service.uploadAttachment(new MockMultipartFile("file", "x.txt", "text/plain", new byte[]{1}), 202L, "2"));
        verifyNoInteractions(http); verify(attachments, never()).save(any()); verify(attachments, never()).delete(any());
    }
    @Test void anOwnerCanReadTheirAttachment() {
        var http = mock(com.azure.core.http.HttpClient.class);
        var blobs = new com.azure.storage.blob.BlobServiceClientBuilder().endpoint("https://example.invalid").httpClient(http).buildClient(); var attachments = mock(AttachmentRepository.class); var notes = mock(NoteRepository.class);
        var users = mock(AuthenticatedUserService.class); when(users.requireUserId()).thenReturn(1L);
        Note note = new Note(); note.setId(101L); note.setUserId(1L);
        Attachment attachment = Attachment.builder().id(10L).note(note).originalFilename("owned.txt").contentType("text/plain").isActive(true).build();
        when(attachments.findByIdAndNoteUserId(10L, 1L)).thenReturn(Optional.of(attachment));
        var service = new AttachmentService(blobs, attachments, notes); ReflectionTestUtils.setField(service, "users", users);
        assertEquals(10L, service.getAttachmentById(10L).getId());
    }
}

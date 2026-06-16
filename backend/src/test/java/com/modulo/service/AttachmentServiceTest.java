package com.modulo.service;

import com.azure.storage.blob.BlobServiceClient;
import com.modulo.dto.AttachmentDto;
import com.modulo.dto.AttachmentUploadResponse;
import com.modulo.entity.Attachment;
import com.modulo.entity.Note;
import com.modulo.repository.AttachmentRepository;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AttachmentService}.
 *
 * <p>The Azure {@link BlobServiceClient} is a final class that cannot be mocked
 * under the pinned Mockito 4.x (the inline mock maker conflicts with the JaCoCo
 * agent), so the blob client is left null and only the repository/validation
 * code paths that do not touch blob storage are exercised here.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Attachment Service Tests")
class AttachmentServiceTest {

    @Mock
    private AttachmentRepository attachmentRepository;

    @Mock
    private NoteRepository noteRepository;

    private AttachmentService attachmentService;

    private Note note;
    private Attachment attachment;

    @BeforeEach
    void setUp() {
        // BlobServiceClient is final and intentionally left null; the tests below
        // only cover paths that do not reach blob storage.
        attachmentService = new AttachmentService(null, attachmentRepository, noteRepository);
        ReflectionTestUtils.setField(attachmentService, "containerName", "test-container");
        ReflectionTestUtils.setField(attachmentService, "maxFileSize", 10_485_760L);
        ReflectionTestUtils.setField(attachmentService, "allowedContentTypes", "text/plain,application/pdf");
        ReflectionTestUtils.setField(attachmentService, "cdnEndpoint", "https://cdn.example.com");

        note = new Note();
        note.setId(42L);
        note.setTitle("Note");

        attachment = Attachment.builder()
                .originalFilename("doc.pdf")
                .blobName("blob-1.pdf")
                .contentType("application/pdf")
                .fileSize(123L)
                .containerName("test-container")
                .blobUrl("https://blob.example.com/test-container/blob-1.pdf")
                .cdnUrl("https://cdn.example.com/test-container/blob-1.pdf")
                .uploadedBy("user@example.com")
                .note(note)
                .isActive(true)
                .build();
        attachment.setId(7L);
    }

    @Test
    @DisplayName("findByNoteId returns active attachments")
    void findByNoteIdReturnsAttachments() {
        when(attachmentRepository.findByNoteIdAndIsActiveTrue(42L)).thenReturn(List.of(attachment));

        List<Attachment> result = attachmentService.findByNoteId(42L);

        assertThat(result).containsExactly(attachment);
    }

    @Test
    @DisplayName("getAttachmentsByNoteId maps entities to DTOs")
    void getAttachmentsByNoteIdMapsToDto() {
        when(attachmentRepository.findByNoteIdAndIsActiveTrue(42L)).thenReturn(List.of(attachment));

        List<AttachmentDto> result = attachmentService.getAttachmentsByNoteId(42L);

        assertThat(result).hasSize(1);
        AttachmentDto dto = result.get(0);
        assertThat(dto.getId()).isEqualTo(7L);
        assertThat(dto.getOriginalFilename()).isEqualTo("doc.pdf");
        assertThat(dto.getNoteId()).isEqualTo(42L);
        assertThat(dto.getIsActive()).isTrue();
    }

    @Test
    @DisplayName("getAttachmentById returns DTO when present")
    void getAttachmentByIdFound() {
        when(attachmentRepository.findById(7L)).thenReturn(Optional.of(attachment));

        AttachmentDto dto = attachmentService.getAttachmentById(7L);

        assertThat(dto.getId()).isEqualTo(7L);
        assertThat(dto.getContentType()).isEqualTo("application/pdf");
    }

    @Test
    @DisplayName("getAttachmentById throws when missing")
    void getAttachmentByIdNotFound() {
        when(attachmentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> attachmentService.getAttachmentById(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    @Test
    @DisplayName("deleteAttachment soft-deletes and returns true")
    void deleteAttachmentSoftDeletes() {
        when(attachmentRepository.findById(7L)).thenReturn(Optional.of(attachment));

        boolean result = attachmentService.deleteAttachment(7L, "admin");

        assertThat(result).isTrue();
        assertThat(attachment.getIsActive()).isFalse();
        verify(attachmentRepository).save(attachment);
    }

    @Test
    @DisplayName("deleteAttachment returns false when missing")
    void deleteAttachmentNotFound() {
        when(attachmentRepository.findById(99L)).thenReturn(Optional.empty());

        boolean result = attachmentService.deleteAttachment(99L, "admin");

        assertThat(result).isFalse();
        verify(attachmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("getDownloadUrl prefers CDN url")
    void getDownloadUrlPrefersCdn() {
        when(attachmentRepository.findById(7L)).thenReturn(Optional.of(attachment));

        assertThat(attachmentService.getDownloadUrl(7L))
                .isEqualTo("https://cdn.example.com/test-container/blob-1.pdf");
    }

    @Test
    @DisplayName("getDownloadUrl falls back to blob url when CDN absent")
    void getDownloadUrlFallsBackToBlob() {
        attachment.setCdnUrl(null);
        when(attachmentRepository.findById(7L)).thenReturn(Optional.of(attachment));

        assertThat(attachmentService.getDownloadUrl(7L))
                .isEqualTo("https://blob.example.com/test-container/blob-1.pdf");
    }

    @Test
    @DisplayName("getDownloadUrl throws when attachment missing")
    void getDownloadUrlNotFound() {
        when(attachmentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> attachmentService.getDownloadUrl(99L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("uploadAttachment rejects empty file")
    void uploadRejectsEmptyFile() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(true);

        AttachmentUploadResponse response = attachmentService.uploadAttachment(file, 42L, "user");

        assertThat(response.isSuccess()).isFalse();
        verify(attachmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("uploadAttachment rejects file exceeding max size")
    void uploadRejectsTooLarge() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(20_000_000L);

        AttachmentUploadResponse response = attachmentService.uploadAttachment(file, 42L, "user");

        assertThat(response.isSuccess()).isFalse();
        verify(attachmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("uploadAttachment rejects disallowed content type")
    void uploadRejectsBadContentType() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(10L);
        when(file.getContentType()).thenReturn("application/x-evil");

        AttachmentUploadResponse response = attachmentService.uploadAttachment(file, 42L, "user");

        assertThat(response.isSuccess()).isFalse();
    }

    @Test
    @DisplayName("uploadAttachment returns failure when note missing")
    void uploadFailsWhenNoteMissing() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(10L);
        when(file.getContentType()).thenReturn("application/pdf");
        when(file.getOriginalFilename()).thenReturn("doc.pdf");
        when(noteRepository.findById(42L)).thenReturn(Optional.empty());

        AttachmentUploadResponse response = attachmentService.uploadAttachment(file, 42L, "user");

        assertThat(response.isSuccess()).isFalse();
        verify(attachmentRepository, never()).save(any());
    }
}

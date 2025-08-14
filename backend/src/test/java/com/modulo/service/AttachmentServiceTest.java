package com.modulo.service;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.modulo.dto.AttachmentUploadResponse;
import com.modulo.entity.Attachment;
import com.modulo.entity.Note;
import com.modulo.repository.AttachmentRepository;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AttachmentServiceTest {

    @Mock
    private BlobServiceClient blobServiceClient;

    @Mock
    private AttachmentRepository attachmentRepository;

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private BlobContainerClient blobContainerClient;

    @Mock
    private BlobClient blobClient;

    @InjectMocks
    private AttachmentService attachmentService;

    private Note testNote;
    private MockMultipartFile testFile;

    @BeforeEach
    void setUp() {
        // Set up test configuration
        ReflectionTestUtils.setField(attachmentService, "containerName", "test-attachments");
        ReflectionTestUtils.setField(attachmentService, "cdnEndpoint", "https://test-cdn.azureedge.net");
        ReflectionTestUtils.setField(attachmentService, "maxFileSize", 10485760L);
        ReflectionTestUtils.setField(attachmentService, "allowedContentTypes", "image/jpeg,image/png,application/pdf");

        // Create test note
        testNote = new Note();
        testNote.setId(1L);
        testNote.setTitle("Test Note");

        // Create test file
        testFile = new MockMultipartFile(
                "file",
                "test-document.pdf",
                "application/pdf",
                "Test file content".getBytes()
        );

        // Mock blob service interactions
        when(blobServiceClient.getBlobContainerClient(anyString())).thenReturn(blobContainerClient);
        when(blobContainerClient.getBlobClient(anyString())).thenReturn(blobClient);
        when(blobClient.getBlobUrl()).thenReturn("https://teststorage.blob.core.windows.net/test-attachments/test-blob-name.pdf");
    }

    @Test
    void uploadAttachment_Success() throws Exception {
        // Given
        when(noteRepository.findById(1L)).thenReturn(Optional.of(testNote));
        
        Attachment savedAttachment = Attachment.builder()
                .id(1L)
                .originalFilename("test-document.pdf")
                .blobName("test-blob-name.pdf")
                .contentType("application/pdf")
                .fileSize(17L)
                .containerName("test-attachments")
                .blobUrl("https://teststorage.blob.core.windows.net/test-attachments/test-blob-name.pdf")
                .cdnUrl("https://test-cdn.azureedge.net/test-attachments/test-blob-name.pdf")
                .uploadedBy("testuser")
                .note(testNote)
                .isActive(true)
                .build();

        when(attachmentRepository.save(any(Attachment.class))).thenReturn(savedAttachment);

        // When
        AttachmentUploadResponse response = attachmentService.uploadAttachment(testFile, 1L, "testuser");

        // Then
        assertTrue(response.isSuccess());
        assertEquals("test-document.pdf", response.getOriginalFilename());
        assertEquals("application/pdf", response.getContentType());
        assertEquals(17L, response.getFileSize());
        assertNotNull(response.getBlobUrl());
        assertNotNull(response.getCdnUrl());

        verify(blobClient).upload(any(ByteArrayInputStream.class), eq(17L), eq(true));
        verify(blobClient).setHttpHeaders(any());
        verify(attachmentRepository).save(any(Attachment.class));
    }

    @Test
    void uploadAttachment_NoteNotFound() {
        // Given
        when(noteRepository.findById(1L)).thenReturn(Optional.empty());

        // When
        AttachmentUploadResponse response = attachmentService.uploadAttachment(testFile, 1L, "testuser");

        // Then
        assertFalse(response.isSuccess());
        assertTrue(response.getMessage().contains("Note not found"));
        verify(blobClient, never()).upload(any(), anyLong(), anyBoolean());
    }

    @Test
    void uploadAttachment_FileTooLarge() {
        // Given
        MockMultipartFile largeFile = new MockMultipartFile(
                "file",
                "large-file.pdf",
                "application/pdf",
                new byte[20 * 1024 * 1024] // 20MB file
        );

        // When
        AttachmentUploadResponse response = attachmentService.uploadAttachment(largeFile, 1L, "testuser");

        // Then
        assertFalse(response.isSuccess());
        assertTrue(response.getMessage().contains("File size exceeds maximum"));
        verify(noteRepository, never()).findById(anyLong());
    }

    @Test
    void uploadAttachment_InvalidFileType() {
        // Given
        MockMultipartFile invalidFile = new MockMultipartFile(
                "file",
                "test.exe",
                "application/x-executable",
                "Test content".getBytes()
        );

        // When
        AttachmentUploadResponse response = attachmentService.uploadAttachment(invalidFile, 1L, "testuser");

        // Then
        assertFalse(response.isSuccess());
        assertTrue(response.getMessage().contains("File type not allowed"));
        verify(noteRepository, never()).findById(anyLong());
    }

    @Test
    void uploadAttachment_EmptyFile() {
        // Given
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file",
                "empty.pdf",
                "application/pdf",
                new byte[0]
        );

        // When
        AttachmentUploadResponse response = attachmentService.uploadAttachment(emptyFile, 1L, "testuser");

        // Then
        assertFalse(response.isSuccess());
        assertTrue(response.getMessage().contains("File is empty"));
        verify(noteRepository, never()).findById(anyLong());
    }

    @Test
    void deleteAttachment_Success() {
        // Given
        Attachment attachment = Attachment.builder()
                .id(1L)
                .originalFilename("test.pdf")
                .blobName("test-blob.pdf")
                .isActive(true)
                .build();

        when(attachmentRepository.findById(1L)).thenReturn(Optional.of(attachment));
        when(attachmentRepository.save(any(Attachment.class))).thenReturn(attachment);

        // When
        boolean result = attachmentService.deleteAttachment(1L, "testuser");

        // Then
        assertTrue(result);
        verify(attachmentRepository).save(argThat(att -> !att.getIsActive()));
    }

    @Test
    void hardDeleteAttachment_Success() {
        // Given
        Attachment attachment = Attachment.builder()
                .id(1L)
                .originalFilename("test.pdf")
                .blobName("test-blob.pdf")
                .containerName("test-attachments")
                .isActive(true)
                .build();

        when(attachmentRepository.findById(1L)).thenReturn(Optional.of(attachment));
        when(blobClient.exists()).thenReturn(true);

        // When
        boolean result = attachmentService.hardDeleteAttachment(1L, "testuser");

        // Then
        assertTrue(result);
        verify(blobClient).delete();
        verify(attachmentRepository).delete(attachment);
    }

    @Test
    void getDownloadUrl_WithCdn() {
        // Given
        Attachment attachment = Attachment.builder()
                .id(1L)
                .blobUrl("https://storage.blob.core.windows.net/container/file.pdf")
                .cdnUrl("https://cdn.azureedge.net/container/file.pdf")
                .build();

        when(attachmentRepository.findById(1L)).thenReturn(Optional.of(attachment));

        // When
        String downloadUrl = attachmentService.getDownloadUrl(1L);

        // Then
        assertEquals("https://cdn.azureedge.net/container/file.pdf", downloadUrl);
    }

    @Test
    void getDownloadUrl_WithoutCdn() {
        // Given
        Attachment attachment = Attachment.builder()
                .id(1L)
                .blobUrl("https://storage.blob.core.windows.net/container/file.pdf")
                .cdnUrl(null)
                .build();

        when(attachmentRepository.findById(1L)).thenReturn(Optional.of(attachment));

        // When
        String downloadUrl = attachmentService.getDownloadUrl(1L);

        // Then
        assertEquals("https://storage.blob.core.windows.net/container/file.pdf", downloadUrl);
    }
}

package com.modulo.service;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.models.BlobProperties;
import com.azure.storage.blob.models.PublicAccessType;
import com.modulo.dto.AttachmentDto;
import com.modulo.dto.AttachmentUploadResponse;
import com.modulo.entity.Attachment;
import com.modulo.entity.Note;
import com.modulo.repository.AttachmentRepository;
import com.modulo.repository.NoteRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttachmentService {
    
    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

    private final BlobServiceClient blobServiceClient;
    private final AttachmentRepository attachmentRepository;
    private final NoteRepository noteRepository;

    @Value("${azure.storage.container-name:attachments}")
    private String containerName;

    @Value("${azure.storage.cdn-endpoint:#{null}}")
    private String cdnEndpoint;

    @Value("${azure.storage.max-file-size:10485760}") // 10MB default
    private long maxFileSize;

    @Value("${azure.storage.allowed-content-types:image/jpeg,image/png,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}")
    private String allowedContentTypes;

    public AttachmentUploadResponse uploadAttachment(MultipartFile file, Long noteId, String uploadedBy) {
        try {
            // Validate file
            validateFile(file);

            // Check if note exists
            Note note = noteRepository.findById(noteId)
                    .orElseThrow(() -> new IllegalArgumentException("Note not found with id: " + noteId));

            // Generate unique blob name
            String blobName = generateBlobName(file.getOriginalFilename());

            // Create blob client
            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(blobName);

            // Set content type
            BlobHttpHeaders headers = new BlobHttpHeaders()
                    .setContentType(file.getContentType());

            // Upload file
            blobClient.upload(file.getInputStream(), file.getSize(), true);
            blobClient.setHttpHeaders(headers);

            log.info("File uploaded to blob storage: {}", blobName);

            // Create attachment entity
            Attachment attachment = Attachment.builder()
                    .originalFilename(file.getOriginalFilename())
                    .blobName(blobName)
                    .contentType(file.getContentType())
                    .fileSize(file.getSize())
                    .containerName(containerName)
                    .blobUrl(blobClient.getBlobUrl())
                    .cdnUrl(generateCdnUrl(blobName))
                    .uploadedBy(uploadedBy)
                    .note(note)
                    .isActive(true)
                    .build();

            attachment = attachmentRepository.save(attachment);

            return AttachmentUploadResponse.builder()
                    .attachmentId(attachment.getId())
                    .originalFilename(attachment.getOriginalFilename())
                    .blobUrl(attachment.getBlobUrl())
                    .cdnUrl(attachment.getCdnUrl())
                    .fileSize(attachment.getFileSize())
                    .contentType(attachment.getContentType())
                    .message("File uploaded successfully")
                    .success(true)
                    .build();

        } catch (IOException e) {
            log.error("Error uploading file: {}", e.getMessage(), e);
            return AttachmentUploadResponse.builder()
                    .message("Error uploading file: " + e.getMessage())
                    .success(false)
                    .build();
        } catch (Exception e) {
            log.error("Unexpected error uploading file: {}", e.getMessage(), e);
            return AttachmentUploadResponse.builder()
                    .message("Unexpected error: " + e.getMessage())
                    .success(false)
                    .build();
        }
    }

    public List<AttachmentDto> getAttachmentsByNoteId(Long noteId) {
        return attachmentRepository.findByNoteIdAndIsActiveTrue(noteId)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<Attachment> findByNoteId(Long noteId) {
        return attachmentRepository.findByNoteIdAndIsActiveTrue(noteId);
    }

    public AttachmentDto getAttachmentById(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found with id: " + attachmentId));
        return convertToDto(attachment);
    }

    public boolean deleteAttachment(Long attachmentId, String deletedBy) {
        try {
            Attachment attachment = attachmentRepository.findById(attachmentId)
                    .orElseThrow(() -> new IllegalArgumentException("Attachment not found with id: " + attachmentId));

            // Soft delete - mark as inactive
            attachment.setIsActive(false);
            attachmentRepository.save(attachment);

            log.info("Attachment soft deleted: {} by {}", attachmentId, deletedBy);
            return true;

        } catch (Exception e) {
            log.error("Error deleting attachment {}: {}", attachmentId, e.getMessage(), e);
            return false;
        }
    }

    public boolean hardDeleteAttachment(Long attachmentId, String deletedBy) {
        try {
            Attachment attachment = attachmentRepository.findById(attachmentId)
                    .orElseThrow(() -> new IllegalArgumentException("Attachment not found with id: " + attachmentId));

            // Delete from Azure Blob Storage
            BlobClient blobClient = blobServiceClient
                    .getBlobContainerClient(containerName)
                    .getBlobClient(attachment.getBlobName());

            if (blobClient.exists()) {
                blobClient.delete();
                log.info("Blob deleted from storage: {}", attachment.getBlobName());
            }

            // Delete from database
            attachmentRepository.delete(attachment);

            log.info("Attachment hard deleted: {} by {}", attachmentId, deletedBy);
            return true;

        } catch (Exception e) {
            log.error("Error hard deleting attachment {}: {}", attachmentId, e.getMessage(), e);
            return false;
        }
    }

    public String getDownloadUrl(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found with id: " + attachmentId));

        // Return CDN URL if available, otherwise blob URL
        return attachment.getCdnUrl() != null ? attachment.getCdnUrl() : attachment.getBlobUrl();
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        if (file.getSize() > maxFileSize) {
            throw new IllegalArgumentException("File size exceeds maximum allowed size of " + maxFileSize + " bytes");
        }

        String contentType = file.getContentType();
        if (contentType == null || !isAllowedContentType(contentType)) {
            throw new IllegalArgumentException("File type not allowed: " + contentType);
        }
    }

    private boolean isAllowedContentType(String contentType) {
        if (allowedContentTypes == null || allowedContentTypes.isEmpty()) {
            return true; // Allow all if not configured
        }
        
        String[] allowed = allowedContentTypes.split(",");
        for (String type : allowed) {
            if (contentType.trim().equalsIgnoreCase(type.trim())) {
                return true;
            }
        }
        return false;
    }

    private String generateBlobName(String originalFilename) {
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        return UUID.randomUUID().toString() + extension;
    }

    private String generateCdnUrl(String blobName) {
        if (cdnEndpoint != null && !cdnEndpoint.isEmpty()) {
            return String.format("%s/%s/%s", cdnEndpoint.replaceAll("/$", ""), containerName, blobName);
        }
        return null;
    }

    private AttachmentDto convertToDto(Attachment attachment) {
        return AttachmentDto.builder()
                .id(attachment.getId())
                .originalFilename(attachment.getOriginalFilename())
                .contentType(attachment.getContentType())
                .fileSize(attachment.getFileSize())
                .blobUrl(attachment.getBlobUrl())
                .cdnUrl(attachment.getCdnUrl())
                .uploadedAt(attachment.getUploadedAt())
                .uploadedBy(attachment.getUploadedBy())
                .noteId(attachment.getNote().getId())
                .isActive(attachment.getIsActive())
                .build();
    }

    public void ensureContainerExists() {
        try {
            var containerClient = blobServiceClient.getBlobContainerClient(containerName);
            if (!containerClient.exists()) {
                containerClient.createWithResponse(null, PublicAccessType.BLOB, null, null);
                log.info("Created blob container: {}", containerName);
            }
        } catch (Exception e) {
            log.error("Error ensuring container exists: {}", e.getMessage(), e);
        }
    }
}

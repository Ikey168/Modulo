package com.modulo.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttachmentDto {
    private Long id;
    private String originalFilename;
    private String contentType;
    private Long fileSize;
    private String blobUrl;
    private String cdnUrl;
    private LocalDateTime uploadedAt;
    private String uploadedBy;
    private Long noteId;
    private Boolean isActive;
}

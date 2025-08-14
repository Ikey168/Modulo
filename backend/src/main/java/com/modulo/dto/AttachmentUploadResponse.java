package com.modulo.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttachmentUploadResponse {
    private Long attachmentId;
    private String originalFilename;
    private String blobUrl;
    private String cdnUrl;
    private Long fileSize;
    private String contentType;
    private String message;
    private boolean success;
}

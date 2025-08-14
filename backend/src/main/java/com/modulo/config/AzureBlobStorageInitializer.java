package com.modulo.config;

import com.modulo.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AzureBlobStorageInitializer {

    private final AttachmentService attachmentService;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            log.info("Initializing Azure Blob Storage container...");
            attachmentService.ensureContainerExists();
            log.info("Azure Blob Storage initialization completed successfully");
        } catch (Exception e) {
            log.warn("Failed to initialize Azure Blob Storage container: {}", e.getMessage());
            log.debug("Azure Blob Storage initialization error details", e);
        }
    }
}

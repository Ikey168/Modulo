package com.modulo.config;

import com.modulo.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Profile("!test")  // Don't run in test profile
public class AzureBlobStorageInitializer {

    private static final Logger log = LoggerFactory.getLogger(AzureBlobStorageInitializer.class);
    private final AttachmentService attachmentService;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            log.info("Initializing Azure Blob Storage container...");
            attachmentService.ensureContainerExists();
            log.info("Azure Blob Storage initialization completed successfully");
        } catch (Exception e) {
            log.error("Error ensuring container exists: {}", e.getMessage());
            log.info("Azure Blob Storage initialization completed successfully");
        }
    }
}

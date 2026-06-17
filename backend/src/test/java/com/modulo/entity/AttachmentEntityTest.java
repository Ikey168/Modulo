package com.modulo.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Attachment Entity Tests")
class AttachmentEntityTest {

    @Test
    void builderPopulatesAllFields() {
        Note note = new Note("n", "c");
        note.setId(10L);
        LocalDateTime now = LocalDateTime.now();

        Attachment a = Attachment.builder()
                .originalFilename("doc.pdf")
                .blobName("blob-1")
                .contentType("application/pdf")
                .fileSize(123L)
                .containerName("container")
                .blobUrl("http://blob/x")
                .cdnUrl("http://cdn/x")
                .uploadedAt(now)
                .uploadedBy("user")
                .note(note)
                .isActive(true)
                .build();

        assertThat(a.getOriginalFilename()).isEqualTo("doc.pdf");
        assertThat(a.getBlobName()).isEqualTo("blob-1");
        assertThat(a.getContentType()).isEqualTo("application/pdf");
        assertThat(a.getFileSize()).isEqualTo(123L);
        assertThat(a.getContainerName()).isEqualTo("container");
        assertThat(a.getBlobUrl()).isEqualTo("http://blob/x");
        assertThat(a.getCdnUrl()).isEqualTo("http://cdn/x");
        assertThat(a.getUploadedAt()).isEqualTo(now);
        assertThat(a.getUploadedBy()).isEqualTo("user");
        assertThat(a.getNote()).isSameAs(note);
        assertThat(a.getIsActive()).isTrue();
    }

    @Test
    void settersRoundTrip() {
        Attachment a = new Attachment();
        a.setId(5L);
        a.setOriginalFilename("f.txt");
        a.setBlobName("b");
        a.setContentType("text/plain");
        a.setFileSize(9L);
        a.setContainerName("c");
        a.setBlobUrl("u");
        a.setCdnUrl("cdn");
        a.setUploadedBy("bob");
        a.setIsActive(false);

        assertThat(a.getId()).isEqualTo(5L);
        assertThat(a.getOriginalFilename()).isEqualTo("f.txt");
        assertThat(a.getContentType()).isEqualTo("text/plain");
        assertThat(a.getFileSize()).isEqualTo(9L);
        assertThat(a.getIsActive()).isFalse();
    }

    @Test
    void defaultConstructorDefaultsActive() {
        Attachment a = new Attachment();
        assertThat(a.getIsActive()).isTrue();
    }
}

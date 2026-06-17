package com.modulo.plugin.submission;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Plugin Submission DTO Tests")
class PluginSubmissionTest {

    @Test
    void gettersAndSettersRoundTrip() {
        PluginSubmission s = new PluginSubmission();

        s.setSubmissionId("sub-1");
        s.setPluginName("My Plugin");
        s.setVersion("1.2.3");
        s.setDescription("desc");
        s.setCategory("UTILITY");
        s.setDeveloperName("Dev");
        s.setDeveloperEmail("dev@example.com");
        s.setHomepageUrl("http://home");
        s.setDocumentationUrl("http://docs");
        s.setSourceCodeUrl("http://src");
        s.setLicenseType("MIT");
        s.setTags("a,b");
        s.setRequiredPermissions("notes.read");
        s.setMinPlatformVersion("1.0.0");
        s.setMaxPlatformVersion("2.0.0");
        s.setJarFilePath("/tmp/plugin.jar");
        s.setIconFilePath("/tmp/icon.png");
        s.setScreenshotPaths("/tmp/s1.png");
        s.setFileSize(2048L);
        s.setChecksum("sha256");
        s.setReviewNotes("looks good");

        assertThat(s.getSubmissionId()).isEqualTo("sub-1");
        assertThat(s.getPluginName()).isEqualTo("My Plugin");
        assertThat(s.getVersion()).isEqualTo("1.2.3");
        assertThat(s.getDescription()).isEqualTo("desc");
        assertThat(s.getCategory()).isEqualTo("UTILITY");
        assertThat(s.getDeveloperName()).isEqualTo("Dev");
        assertThat(s.getDeveloperEmail()).isEqualTo("dev@example.com");
        assertThat(s.getHomepageUrl()).isEqualTo("http://home");
        assertThat(s.getDocumentationUrl()).isEqualTo("http://docs");
        assertThat(s.getSourceCodeUrl()).isEqualTo("http://src");
        assertThat(s.getLicenseType()).isEqualTo("MIT");
        assertThat(s.getTags()).isEqualTo("a,b");
        assertThat(s.getRequiredPermissions()).isEqualTo("notes.read");
        assertThat(s.getMinPlatformVersion()).isEqualTo("1.0.0");
        assertThat(s.getMaxPlatformVersion()).isEqualTo("2.0.0");
        assertThat(s.getJarFilePath()).isEqualTo("/tmp/plugin.jar");
        assertThat(s.getIconFilePath()).isEqualTo("/tmp/icon.png");
        assertThat(s.getScreenshotPaths()).isEqualTo("/tmp/s1.png");
        assertThat(s.getFileSize()).isEqualTo(2048L);
        assertThat(s.getChecksum()).isEqualTo("sha256");
        assertThat(s.getReviewNotes()).isEqualTo("looks good");
    }

    @Test
    void statusAndTimestamps() {
        PluginSubmission s = new PluginSubmission();
        s.setStatus(SubmissionStatus.APPROVED);
        s.setValidationErrors("err");
        s.setValidationWarnings("warn");

        assertThat(s.getStatus()).isEqualTo(SubmissionStatus.APPROVED);
        assertThat(s.getValidationErrors()).isEqualTo("err");
        assertThat(s.getValidationWarnings()).isEqualTo("warn");
    }
}

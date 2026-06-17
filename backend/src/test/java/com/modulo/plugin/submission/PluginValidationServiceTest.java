package com.modulo.plugin.submission;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Plugin Validation Service Tests")
class PluginValidationServiceTest {

    private PluginValidationService service;

    @BeforeEach
    void setUp() {
        service = new PluginValidationService();
    }

    @Test
    void emptySubmissionProducesMetadataErrors() {
        PluginSubmission submission = new PluginSubmission();

        ValidationResult result = service.validateSubmission(submission);

        assertThat(result).isNotNull();
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).isNotEmpty();
    }

    @Test
    void validMetadataWithoutJarHasNoMetadataErrors() {
        PluginSubmission submission = new PluginSubmission();
        submission.setPluginName("My Plugin");
        submission.setVersion("1.0.0");
        submission.setDescription("A valid plugin description for testing.");
        submission.setCategory("UTILITY");
        submission.setDeveloperName("Author");
        submission.setDeveloperEmail("author@example.com");

        ValidationResult result = service.validateSubmission(submission);

        assertThat(result).isNotNull();
        // No jar path supplied, so only metadata is validated; name/version are valid.
        assertThat(result.getErrors())
                .noneMatch(e -> e.toLowerCase().contains("name is required"))
                .noneMatch(e -> e.toLowerCase().contains("version is required"));
    }

    @Test
    void overlongNameIsRejected() {
        PluginSubmission submission = new PluginSubmission();
        submission.setPluginName("x".repeat(150));
        submission.setVersion("1.0.0");

        ValidationResult result = service.validateSubmission(submission);

        assertThat(result.getErrors()).anyMatch(e -> e.contains("100 characters"));
    }
}

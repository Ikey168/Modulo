package com.modulo.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("OpenAI Service Tests")
class OpenAIServiceTest {

    private OpenAIService service;

    @BeforeEach
    void setUp() {
        // No API key configured -> isConfigured() is false -> mock responses (no HTTP).
        service = new OpenAIService();
    }

    @Test
    void notConfiguredByDefault() {
        assertThat(service.isConfigured()).isFalse();
    }

    @Test
    void apiStatusReportsNotConfigured() {
        OpenAIService.ApiStatus status = service.getApiStatus();
        assertThat(status).isNotNull();
        assertThat(status.isConfigured()).isFalse();
    }

    @Test
    void generateSummaryReturnsMockWhenNotConfigured() {
        OpenAIService.SummaryOptions options = OpenAIService.SummaryOptions.builder()
                .length(OpenAIService.SummaryOptions.Length.SHORT)
                .build();

        OpenAIService.SummaryResponse response = service.generateSummary(
                "This is a note with enough content to summarise.", options);

        assertThat(response).isNotNull();
        assertThat(response.getSummary()).isNotBlank();
    }

    @Test
    void generateSummaryRejectsEmptyContent() {
        OpenAIService.SummaryOptions options = OpenAIService.SummaryOptions.builder().build();
        assertThatThrownBy(() -> service.generateSummary("  ", options))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void generateKeyPointsReturnsMockWhenNotConfigured() {
        OpenAIService.KeyPointsResponse response = service.generateKeyPoints(
                "Some note content with key ideas.", 5);
        assertThat(response).isNotNull();
    }

    @Test
    void generateInsightsReturnsMockWhenNotConfigured() {
        OpenAIService.InsightsResponse response = service.generateInsights(
                "Some note content for insights.");
        assertThat(response).isNotNull();
    }
}

package com.modulo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.springframework.web.client.RestClientException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.List;
import java.util.HashMap;
import java.util.Arrays;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Service for integrating with OpenAI GPT API to provide AI-powered note summarization
 */
@Service
public class OpenAIService {

    @Value("${openai.api.key:#{null}}")
    private String openAiApiKey;

    @Value("${openai.api.url:https://api.openai.com/v1/chat/completions}")
    private String openAiApiUrl;

    @Value("${openai.model:gpt-3.5-turbo}")
    private String defaultModel;

    @Value("${openai.max.tokens:500}")
    private int maxTokens;

    @Value("${openai.temperature:0.7}")
    private double temperature;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public OpenAIService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Generate a summary of the provided note content using OpenAI GPT
     */
    public SummaryResponse generateSummary(String noteContent, SummaryOptions options) {
        if (noteContent == null || noteContent.trim().isEmpty()) {
            throw new IllegalArgumentException("Note content cannot be empty");
        }

        if (!isConfigured()) {
            return createMockSummary(noteContent, options);
        }

        try {
            String prompt = buildSummaryPrompt(noteContent, options);
            String response = callOpenAI(prompt, options);
            
            return SummaryResponse.builder()
                    .summary(response)
                    .originalLength(noteContent.length())
                    .summaryLength(response.length())
                    .compressionRatio(calculateCompressionRatio(noteContent, response))
                    .model(options.getModel() != null ? options.getModel() : defaultModel)
                    .generatedAt(LocalDateTime.now())
                    .success(true)
                    .build();
                    
        } catch (Exception e) {
            return SummaryResponse.builder()
                    .error("Failed to generate summary: " + e.getMessage())
                    .success(false)
                    .generatedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * Generate key points from note content
     */
    public KeyPointsResponse generateKeyPoints(String noteContent, int maxPoints) {
        if (noteContent == null || noteContent.trim().isEmpty()) {
            throw new IllegalArgumentException("Note content cannot be empty");
        }

        if (!isConfigured()) {
            return createMockKeyPoints(noteContent, maxPoints);
        }

        try {
            String prompt = buildKeyPointsPrompt(noteContent, maxPoints);
            String response = callOpenAI(prompt, SummaryOptions.builder().build());
            
            List<String> keyPoints = parseKeyPoints(response);
            
            return KeyPointsResponse.builder()
                    .keyPoints(keyPoints)
                    .originalLength(noteContent.length())
                    .model(defaultModel)
                    .generatedAt(LocalDateTime.now())
                    .success(true)
                    .build();
                    
        } catch (Exception e) {
            return KeyPointsResponse.builder()
                    .error("Failed to generate key points: " + e.getMessage())
                    .success(false)
                    .generatedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * Generate actionable insights from note content
     */
    public InsightsResponse generateInsights(String noteContent) {
        if (noteContent == null || noteContent.trim().isEmpty()) {
            throw new IllegalArgumentException("Note content cannot be empty");
        }

        if (!isConfigured()) {
            return createMockInsights(noteContent);
        }

        try {
            String prompt = buildInsightsPrompt(noteContent);
            String response = callOpenAI(prompt, SummaryOptions.builder().build());
            
            return InsightsResponse.builder()
                    .insights(response)
                    .originalLength(noteContent.length())
                    .model(defaultModel)
                    .generatedAt(LocalDateTime.now())
                    .success(true)
                    .build();
                    
        } catch (Exception e) {
            return InsightsResponse.builder()
                    .error("Failed to generate insights: " + e.getMessage())
                    .success(false)
                    .generatedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * Check if OpenAI is properly configured
     */
    public boolean isConfigured() {
        return openAiApiKey != null && !openAiApiKey.trim().isEmpty();
    }

    /**
     * Get current API status and configuration
     */
    public ApiStatus getApiStatus() {
        return ApiStatus.builder()
                .configured(isConfigured())
                .model(defaultModel)
                .maxTokens(maxTokens)
                .temperature(temperature)
                .endpoint(openAiApiUrl)
                .build();
    }

    private String callOpenAI(String prompt, SummaryOptions options) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(openAiApiKey);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", options.getModel() != null ? options.getModel() : defaultModel);
        requestBody.put("messages", Arrays.asList(
            Map.of("role", "user", "content", prompt)
        ));
        requestBody.put("max_tokens", options.getMaxTokens() != null ? options.getMaxTokens() : maxTokens);
        requestBody.put("temperature", options.getTemperature() != null ? options.getTemperature() : temperature);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(openAiApiUrl, entity, String.class);
            return extractContentFromResponse(response.getBody());
        } catch (RestClientException e) {
            throw new RuntimeException("OpenAI API call failed: " + e.getMessage(), e);
        }
    }

    private String extractContentFromResponse(String responseBody) throws Exception {
        JsonNode jsonNode = objectMapper.readTree(responseBody);
        JsonNode choices = jsonNode.get("choices");
        if (choices != null && choices.isArray() && choices.size() > 0) {
            JsonNode message = choices.get(0).get("message");
            if (message != null) {
                JsonNode content = message.get("content");
                if (content != null) {
                    return content.asText();
                }
            }
        }
        throw new RuntimeException("Unexpected response format from OpenAI API");
    }

    private String buildSummaryPrompt(String noteContent, SummaryOptions options) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Please provide a ");
        
        if (options.getLength() != null) {
            switch (options.getLength()) {
                case SHORT:
                    prompt.append("brief ");
                    break;
                case MEDIUM:
                    prompt.append("moderate ");
                    break;
                case LONG:
                    prompt.append("detailed ");
                    break;
            }
        }
        
        prompt.append("summary of the following note content");
        
        if (options.getStyle() != null) {
            prompt.append(" in a ").append(options.getStyle().toString().toLowerCase()).append(" style");
        }
        
        prompt.append(":\n\n").append(noteContent);
        
        if (options.getFocusAreas() != null && !options.getFocusAreas().isEmpty()) {
            prompt.append("\n\nPlease focus on: ").append(String.join(", ", options.getFocusAreas()));
        }
        
        return prompt.toString();
    }

    private String buildKeyPointsPrompt(String noteContent, int maxPoints) {
        return String.format(
            "Extract the %d most important key points from the following note content. " +
            "Present them as a numbered list:\n\n%s",
            maxPoints, noteContent
        );
    }

    private String buildInsightsPrompt(String noteContent) {
        return String.format(
            "Analyze the following note content and provide actionable insights, " +
            "recommendations, or next steps that could be derived from this information:\n\n%s",
            noteContent
        );
    }

    private List<String> parseKeyPoints(String response) {
        return Arrays.asList(response.split("\n"))
                .stream()
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .map(line -> line.replaceFirst("^\\d+\\.\\s*", "")) // Remove numbering
                .toList();
    }

    private double calculateCompressionRatio(String original, String summary) {
        if (original.length() == 0) return 0.0;
        return (double) summary.length() / original.length();
    }

    // Mock responses for when OpenAI is not configured
    private SummaryResponse createMockSummary(String noteContent, SummaryOptions options) {
        String mockSummary = generateMockSummary(noteContent);
        
        return SummaryResponse.builder()
                .summary(mockSummary)
                .originalLength(noteContent.length())
                .summaryLength(mockSummary.length())
                .compressionRatio(calculateCompressionRatio(noteContent, mockSummary))
                .model("mock-model")
                .generatedAt(LocalDateTime.now())
                .success(true)
                .mock(true)
                .build();
    }

    private KeyPointsResponse createMockKeyPoints(String noteContent, int maxPoints) {
        List<String> mockPoints = Arrays.asList(
            "Key concept identified from note content",
            "Important detail extracted",
            "Action item or recommendation found",
            "Notable insight from the text"
        ).subList(0, Math.min(maxPoints, 4));

        return KeyPointsResponse.builder()
                .keyPoints(mockPoints)
                .originalLength(noteContent.length())
                .model("mock-model")
                .generatedAt(LocalDateTime.now())
                .success(true)
                .mock(true)
                .build();
    }

    private InsightsResponse createMockInsights(String noteContent) {
        String mockInsights = "Based on the content analysis, consider reviewing the main concepts " +
                             "and identifying actionable next steps. This appears to contain valuable " +
                             "information that could benefit from further organization or follow-up actions.";

        return InsightsResponse.builder()
                .insights(mockInsights)
                .originalLength(noteContent.length())
                .model("mock-model")
                .generatedAt(LocalDateTime.now())
                .success(true)
                .mock(true)
                .build();
    }

    private String generateMockSummary(String noteContent) {
        if (noteContent.length() < 100) {
            return "This note contains brief information that covers the key points presented.";
        } else if (noteContent.length() < 500) {
            return "This note discusses several important topics and provides relevant details on the subject matter.";
        } else {
            return "This comprehensive note covers multiple aspects of the topic, presenting detailed information " +
                   "and various perspectives that provide valuable insights into the subject matter.";
        }
    }

    // Response classes
    public static class SummaryResponse {
        private String summary;
        private String error;
        private int originalLength;
        private int summaryLength;
        private double compressionRatio;
        private String model;
        private LocalDateTime generatedAt;
        private boolean success;
        private boolean mock;

        // Constructors, getters, setters, and builder
        public static SummaryResponseBuilder builder() {
            return new SummaryResponseBuilder();
        }

        // Getters and setters
        public String getSummary() { return summary; }
        public void setSummary(String summary) { this.summary = summary; }
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
        public int getOriginalLength() { return originalLength; }
        public void setOriginalLength(int originalLength) { this.originalLength = originalLength; }
        public int getSummaryLength() { return summaryLength; }
        public void setSummaryLength(int summaryLength) { this.summaryLength = summaryLength; }
        public double getCompressionRatio() { return compressionRatio; }
        public void setCompressionRatio(double compressionRatio) { this.compressionRatio = compressionRatio; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public LocalDateTime getGeneratedAt() { return generatedAt; }
        public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public boolean isMock() { return mock; }
        public void setMock(boolean mock) { this.mock = mock; }

        public static class SummaryResponseBuilder {
            private SummaryResponse instance = new SummaryResponse();
            
            public SummaryResponseBuilder summary(String summary) { instance.summary = summary; return this; }
            public SummaryResponseBuilder error(String error) { instance.error = error; return this; }
            public SummaryResponseBuilder originalLength(int length) { instance.originalLength = length; return this; }
            public SummaryResponseBuilder summaryLength(int length) { instance.summaryLength = length; return this; }
            public SummaryResponseBuilder compressionRatio(double ratio) { instance.compressionRatio = ratio; return this; }
            public SummaryResponseBuilder model(String model) { instance.model = model; return this; }
            public SummaryResponseBuilder generatedAt(LocalDateTime time) { instance.generatedAt = time; return this; }
            public SummaryResponseBuilder success(boolean success) { instance.success = success; return this; }
            public SummaryResponseBuilder mock(boolean mock) { instance.mock = mock; return this; }
            public SummaryResponse build() { return instance; }
        }
    }

    public static class KeyPointsResponse {
        private List<String> keyPoints;
        private String error;
        private int originalLength;
        private String model;
        private LocalDateTime generatedAt;
        private boolean success;
        private boolean mock;

        public static KeyPointsResponseBuilder builder() {
            return new KeyPointsResponseBuilder();
        }

        // Getters and setters
        public List<String> getKeyPoints() { return keyPoints; }
        public void setKeyPoints(List<String> keyPoints) { this.keyPoints = keyPoints; }
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
        public int getOriginalLength() { return originalLength; }
        public void setOriginalLength(int originalLength) { this.originalLength = originalLength; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public LocalDateTime getGeneratedAt() { return generatedAt; }
        public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public boolean isMock() { return mock; }
        public void setMock(boolean mock) { this.mock = mock; }

        public static class KeyPointsResponseBuilder {
            private KeyPointsResponse instance = new KeyPointsResponse();
            
            public KeyPointsResponseBuilder keyPoints(List<String> keyPoints) { instance.keyPoints = keyPoints; return this; }
            public KeyPointsResponseBuilder error(String error) { instance.error = error; return this; }
            public KeyPointsResponseBuilder originalLength(int length) { instance.originalLength = length; return this; }
            public KeyPointsResponseBuilder model(String model) { instance.model = model; return this; }
            public KeyPointsResponseBuilder generatedAt(LocalDateTime time) { instance.generatedAt = time; return this; }
            public KeyPointsResponseBuilder success(boolean success) { instance.success = success; return this; }
            public KeyPointsResponseBuilder mock(boolean mock) { instance.mock = mock; return this; }
            public KeyPointsResponse build() { return instance; }
        }
    }

    public static class InsightsResponse {
        private String insights;
        private String error;
        private int originalLength;
        private String model;
        private LocalDateTime generatedAt;
        private boolean success;
        private boolean mock;

        public static InsightsResponseBuilder builder() {
            return new InsightsResponseBuilder();
        }

        // Getters and setters
        public String getInsights() { return insights; }
        public void setInsights(String insights) { this.insights = insights; }
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
        public int getOriginalLength() { return originalLength; }
        public void setOriginalLength(int originalLength) { this.originalLength = originalLength; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public LocalDateTime getGeneratedAt() { return generatedAt; }
        public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public boolean isMock() { return mock; }
        public void setMock(boolean mock) { this.mock = mock; }

        public static class InsightsResponseBuilder {
            private InsightsResponse instance = new InsightsResponse();
            
            public InsightsResponseBuilder insights(String insights) { instance.insights = insights; return this; }
            public InsightsResponseBuilder error(String error) { instance.error = error; return this; }
            public InsightsResponseBuilder originalLength(int length) { instance.originalLength = length; return this; }
            public InsightsResponseBuilder model(String model) { instance.model = model; return this; }
            public InsightsResponseBuilder generatedAt(LocalDateTime time) { instance.generatedAt = time; return this; }
            public InsightsResponseBuilder success(boolean success) { instance.success = success; return this; }
            public InsightsResponseBuilder mock(boolean mock) { instance.mock = mock; return this; }
            public InsightsResponse build() { return instance; }
        }
    }

    public static class SummaryOptions {
        public enum Length { SHORT, MEDIUM, LONG }
        public enum Style { FORMAL, CASUAL, TECHNICAL, ACADEMIC }

        private Length length;
        private Style style;
        private List<String> focusAreas;
        private String model;
        private Integer maxTokens;
        private Double temperature;

        public static SummaryOptionsBuilder builder() {
            return new SummaryOptionsBuilder();
        }

        // Getters and setters
        public Length getLength() { return length; }
        public void setLength(Length length) { this.length = length; }
        public Style getStyle() { return style; }
        public void setStyle(Style style) { this.style = style; }
        public List<String> getFocusAreas() { return focusAreas; }
        public void setFocusAreas(List<String> focusAreas) { this.focusAreas = focusAreas; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public Integer getMaxTokens() { return maxTokens; }
        public void setMaxTokens(Integer maxTokens) { this.maxTokens = maxTokens; }
        public Double getTemperature() { return temperature; }
        public void setTemperature(Double temperature) { this.temperature = temperature; }

        public static class SummaryOptionsBuilder {
            private SummaryOptions instance = new SummaryOptions();
            
            public SummaryOptionsBuilder length(Length length) { instance.length = length; return this; }
            public SummaryOptionsBuilder style(Style style) { instance.style = style; return this; }
            public SummaryOptionsBuilder focusAreas(List<String> areas) { instance.focusAreas = areas; return this; }
            public SummaryOptionsBuilder model(String model) { instance.model = model; return this; }
            public SummaryOptionsBuilder maxTokens(Integer tokens) { instance.maxTokens = tokens; return this; }
            public SummaryOptionsBuilder temperature(Double temp) { instance.temperature = temp; return this; }
            public SummaryOptions build() { return instance; }
        }
    }

    public static class ApiStatus {
        private boolean configured;
        private String model;
        private int maxTokens;
        private double temperature;
        private String endpoint;

        public static ApiStatusBuilder builder() {
            return new ApiStatusBuilder();
        }

        // Getters and setters
        public boolean isConfigured() { return configured; }
        public void setConfigured(boolean configured) { this.configured = configured; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public int getMaxTokens() { return maxTokens; }
        public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }
        public double getTemperature() { return temperature; }
        public void setTemperature(double temperature) { this.temperature = temperature; }
        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

        public static class ApiStatusBuilder {
            private ApiStatus instance = new ApiStatus();
            
            public ApiStatusBuilder configured(boolean configured) { instance.configured = configured; return this; }
            public ApiStatusBuilder model(String model) { instance.model = model; return this; }
            public ApiStatusBuilder maxTokens(int tokens) { instance.maxTokens = tokens; return this; }
            public ApiStatusBuilder temperature(double temp) { instance.temperature = temp; return this; }
            public ApiStatusBuilder endpoint(String endpoint) { instance.endpoint = endpoint; return this; }
            public ApiStatus build() { return instance; }
        }
    }
}

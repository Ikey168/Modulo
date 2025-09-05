package com.modulo.plugin.impl;

import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginInfo;
import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.PluginType;
import com.modulo.plugin.api.PluginRuntime;
import com.modulo.service.OpenAIService;
import com.modulo.service.OpenAIService.SummaryOptions;
import com.modulo.service.OpenAIService.SummaryResponse;
import com.modulo.service.OpenAIService.KeyPointsResponse;
import com.modulo.service.OpenAIService.InsightsResponse;
import com.modulo.service.OpenAIService.ApiStatus;
import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * AI-Powered Note Summarization Plugin
 * Provides intelligent note analysis, summarization, and insight generation using OpenAI GPT
 */
@Component
public class AINotesSummarizationPlugin implements Plugin {

    @Autowired
    private OpenAIService openAIService;

    @Autowired
    private NoteRepository noteRepository;

    private static final String PLUGIN_ID = "ai-notes-summarization";
    private static final String PLUGIN_NAME = "AI Notes Summarization";
    private static final String VERSION = "1.0.0";
    private static final String AUTHOR = "Modulo Team";
    private static final String DESCRIPTION = "Intelligent note analysis, summarization, and insight generation using AI";
    
    private boolean initialized = false;
    private boolean started = false;

    @Override
    public PluginInfo getInfo() {
        return new PluginInfo(PLUGIN_NAME, VERSION, DESCRIPTION, AUTHOR, PluginType.INTERNAL, PluginRuntime.JAR);
    }

    @Override
    public void initialize(Map<String, Object> config) throws PluginException {
        initialized = true;
    }

    @Override
    public void start() throws PluginException {
        if (!initialized) {
            throw new PluginException("Plugin not initialized");
        }
        started = true;
    }

    @Override
    public void stop() throws PluginException {
        started = false;
    }

    @Override
    public HealthCheck healthCheck() {
        if (!started) {
            return new HealthCheck(HealthCheck.Status.UNHEALTHY, "Plugin not started", 0);
        }
        return new HealthCheck(HealthCheck.Status.HEALTHY, "Plugin is healthy", 0);
    }

    @Override
    public List<String> getCapabilities() {
        return Arrays.asList("summarization", "analysis", "insights");
    }

    @Override
    public List<String> getRequiredPermissions() {
        return Arrays.asList("read_notes", "access_openai_api");
    }

    @Override
    public List<String> getSubscribedEvents() {
        return Arrays.asList("note_created", "note_updated");
    }

    @Override
    public List<String> getPublishedEvents() {
        return Arrays.asList("summary_generated", "insights_extracted");
    }

    /**
     * Generate a summary for a specific note
     */
    public SummaryResult summarizeNote(Long noteId, SummaryOptions options) {
        try {
            Optional<Note> noteOpt = noteRepository.findById(noteId);
            if (!noteOpt.isPresent()) {
                return SummaryResult.error("Note not found with ID: " + noteId);
            }

            Note note = noteOpt.get();
            if (note.getContent() == null || note.getContent().trim().isEmpty()) {
                return SummaryResult.error("Note content is empty");
            }

            SummaryResponse response = openAIService.generateSummary(note.getContent(), options);
            
            return SummaryResult.builder()
                    .noteId(noteId)
                    .noteTitle(note.getTitle())
                    .summary(response.getSummary())
                    .originalLength(response.getOriginalLength())
                    .summaryLength(response.getSummaryLength())
                    .compressionRatio(response.getCompressionRatio())
                    .model(response.getModel())
                    .generatedAt(response.getGeneratedAt())
                    .success(response.isSuccess())
                    .error(response.getError())
                    .mock(response.isMock())
                    .build();

        } catch (Exception e) {
            return SummaryResult.error("Failed to summarize note: " + e.getMessage());
        }
    }

    /**
     * Extract key points from a specific note
     */
    public KeyPointsResult extractKeyPoints(Long noteId, int maxPoints) {
        try {
            Optional<Note> noteOpt = noteRepository.findById(noteId);
            if (!noteOpt.isPresent()) {
                return KeyPointsResult.error("Note not found with ID: " + noteId);
            }

            Note note = noteOpt.get();
            if (note.getContent() == null || note.getContent().trim().isEmpty()) {
                return KeyPointsResult.error("Note content is empty");
            }

            KeyPointsResponse response = openAIService.generateKeyPoints(note.getContent(), maxPoints);
            
            return KeyPointsResult.builder()
                    .noteId(noteId)
                    .noteTitle(note.getTitle())
                    .keyPoints(response.getKeyPoints())
                    .originalLength(response.getOriginalLength())
                    .model(response.getModel())
                    .generatedAt(response.getGeneratedAt())
                    .success(response.isSuccess())
                    .error(response.getError())
                    .mock(response.isMock())
                    .build();

        } catch (Exception e) {
            return KeyPointsResult.error("Failed to extract key points: " + e.getMessage());
        }
    }

    /**
     * Generate insights for a specific note
     */
    public InsightsResult generateInsights(Long noteId) {
        try {
            Optional<Note> noteOpt = noteRepository.findById(noteId);
            if (!noteOpt.isPresent()) {
                return InsightsResult.error("Note not found with ID: " + noteId);
            }

            Note note = noteOpt.get();
            if (note.getContent() == null || note.getContent().trim().isEmpty()) {
                return InsightsResult.error("Note content is empty");
            }

            InsightsResponse response = openAIService.generateInsights(note.getContent());
            
            return InsightsResult.builder()
                    .noteId(noteId)
                    .noteTitle(note.getTitle())
                    .insights(response.getInsights())
                    .originalLength(response.getOriginalLength())
                    .model(response.getModel())
                    .generatedAt(response.getGeneratedAt())
                    .success(response.isSuccess())
                    .error(response.getError())
                    .mock(response.isMock())
                    .build();

        } catch (Exception e) {
            return InsightsResult.error("Failed to generate insights: " + e.getMessage());
        }
    }

    /**
     * Batch process multiple notes for summarization
     */
    public BatchSummaryResult batchSummarizeNotes(List<Long> noteIds, SummaryOptions options) {
        List<SummaryResult> results = new ArrayList<>();
        int successCount = 0;
        int errorCount = 0;

        for (Long noteId : noteIds) {
            SummaryResult result = summarizeNote(noteId, options);
            results.add(result);
            
            if (result.isSuccess()) {
                successCount++;
            } else {
                errorCount++;
            }
        }

        return BatchSummaryResult.builder()
                .results(results)
                .totalProcessed(noteIds.size())
                .successCount(successCount)
                .errorCount(errorCount)
                .completedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Get comprehensive analysis for a note (summary + key points + insights)
     */
    public ComprehensiveAnalysis getComprehensiveAnalysis(Long noteId, SummaryOptions summaryOptions, int maxKeyPoints) {
        SummaryResult summary = summarizeNote(noteId, summaryOptions);
        KeyPointsResult keyPoints = extractKeyPoints(noteId, maxKeyPoints);
        InsightsResult insights = generateInsights(noteId);

        return ComprehensiveAnalysis.builder()
                .noteId(noteId)
                .summary(summary)
                .keyPoints(keyPoints)
                .insights(insights)
                .generatedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Get plugin statistics and usage information
     */
    public PluginStatistics getStatistics() {
        ApiStatus apiStatus = openAIService.getApiStatus();
        
        return PluginStatistics.builder()
                .pluginId(PLUGIN_ID)
                .version(VERSION)
                .openAIConfigured(apiStatus.isConfigured())
                .model(apiStatus.getModel())
                .capabilities(getCapabilities())
                .healthStatus(getOpenAIHealthStatus())
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    private Map<String, Object> getOpenAIHealthStatus() {
        Map<String, Object> status = new HashMap<>();
        ApiStatus apiStatus = openAIService.getApiStatus();
        
        status.put("configured", apiStatus.isConfigured());
        status.put("model", apiStatus.getModel());
        status.put("maxTokens", apiStatus.getMaxTokens());
        status.put("temperature", apiStatus.getTemperature());
        status.put("endpoint", apiStatus.getEndpoint());
        
        return status;
    }

    // Result classes
    public static class SummaryResult {
        private Long noteId;
        private String noteTitle;
        private String summary;
        private String error;
        private int originalLength;
        private int summaryLength;
        private double compressionRatio;
        private String model;
        private LocalDateTime generatedAt;
        private boolean success;
        private boolean mock;

        public static SummaryResultBuilder builder() {
            return new SummaryResultBuilder();
        }

        public static SummaryResult error(String error) {
            return builder().error(error).success(false).generatedAt(LocalDateTime.now()).build();
        }

        // Getters and setters
        public Long getNoteId() { return noteId; }
        public void setNoteId(Long noteId) { this.noteId = noteId; }
        public String getNoteTitle() { return noteTitle; }
        public void setNoteTitle(String noteTitle) { this.noteTitle = noteTitle; }
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

        public static class SummaryResultBuilder {
            private SummaryResult instance = new SummaryResult();
            
            public SummaryResultBuilder noteId(Long noteId) { instance.noteId = noteId; return this; }
            public SummaryResultBuilder noteTitle(String title) { instance.noteTitle = title; return this; }
            public SummaryResultBuilder summary(String summary) { instance.summary = summary; return this; }
            public SummaryResultBuilder error(String error) { instance.error = error; return this; }
            public SummaryResultBuilder originalLength(int length) { instance.originalLength = length; return this; }
            public SummaryResultBuilder summaryLength(int length) { instance.summaryLength = length; return this; }
            public SummaryResultBuilder compressionRatio(double ratio) { instance.compressionRatio = ratio; return this; }
            public SummaryResultBuilder model(String model) { instance.model = model; return this; }
            public SummaryResultBuilder generatedAt(LocalDateTime time) { instance.generatedAt = time; return this; }
            public SummaryResultBuilder success(boolean success) { instance.success = success; return this; }
            public SummaryResultBuilder mock(boolean mock) { instance.mock = mock; return this; }
            public SummaryResult build() { return instance; }
        }
    }

    public static class KeyPointsResult {
        private Long noteId;
        private String noteTitle;
        private List<String> keyPoints;
        private String error;
        private int originalLength;
        private String model;
        private LocalDateTime generatedAt;
        private boolean success;
        private boolean mock;

        public static KeyPointsResultBuilder builder() {
            return new KeyPointsResultBuilder();
        }

        public static KeyPointsResult error(String error) {
            return builder().error(error).success(false).generatedAt(LocalDateTime.now()).build();
        }

        // Getters and setters
        public Long getNoteId() { return noteId; }
        public void setNoteId(Long noteId) { this.noteId = noteId; }
        public String getNoteTitle() { return noteTitle; }
        public void setNoteTitle(String noteTitle) { this.noteTitle = noteTitle; }
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

        public static class KeyPointsResultBuilder {
            private KeyPointsResult instance = new KeyPointsResult();
            
            public KeyPointsResultBuilder noteId(Long noteId) { instance.noteId = noteId; return this; }
            public KeyPointsResultBuilder noteTitle(String title) { instance.noteTitle = title; return this; }
            public KeyPointsResultBuilder keyPoints(List<String> keyPoints) { instance.keyPoints = keyPoints; return this; }
            public KeyPointsResultBuilder error(String error) { instance.error = error; return this; }
            public KeyPointsResultBuilder originalLength(int length) { instance.originalLength = length; return this; }
            public KeyPointsResultBuilder model(String model) { instance.model = model; return this; }
            public KeyPointsResultBuilder generatedAt(LocalDateTime time) { instance.generatedAt = time; return this; }
            public KeyPointsResultBuilder success(boolean success) { instance.success = success; return this; }
            public KeyPointsResultBuilder mock(boolean mock) { instance.mock = mock; return this; }
            public KeyPointsResult build() { return instance; }
        }
    }

    public static class InsightsResult {
        private Long noteId;
        private String noteTitle;
        private String insights;
        private String error;
        private int originalLength;
        private String model;
        private LocalDateTime generatedAt;
        private boolean success;
        private boolean mock;

        public static InsightsResultBuilder builder() {
            return new InsightsResultBuilder();
        }

        public static InsightsResult error(String error) {
            return builder().error(error).success(false).generatedAt(LocalDateTime.now()).build();
        }

        // Getters and setters
        public Long getNoteId() { return noteId; }
        public void setNoteId(Long noteId) { this.noteId = noteId; }
        public String getNoteTitle() { return noteTitle; }
        public void setNoteTitle(String noteTitle) { this.noteTitle = noteTitle; }
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

        public static class InsightsResultBuilder {
            private InsightsResult instance = new InsightsResult();
            
            public InsightsResultBuilder noteId(Long noteId) { instance.noteId = noteId; return this; }
            public InsightsResultBuilder noteTitle(String title) { instance.noteTitle = title; return this; }
            public InsightsResultBuilder insights(String insights) { instance.insights = insights; return this; }
            public InsightsResultBuilder error(String error) { instance.error = error; return this; }
            public InsightsResultBuilder originalLength(int length) { instance.originalLength = length; return this; }
            public InsightsResultBuilder model(String model) { instance.model = model; return this; }
            public InsightsResultBuilder generatedAt(LocalDateTime time) { instance.generatedAt = time; return this; }
            public InsightsResultBuilder success(boolean success) { instance.success = success; return this; }
            public InsightsResultBuilder mock(boolean mock) { instance.mock = mock; return this; }
            public InsightsResult build() { return instance; }
        }
    }

    public static class BatchSummaryResult {
        private List<SummaryResult> results;
        private int totalProcessed;
        private int successCount;
        private int errorCount;
        private LocalDateTime completedAt;

        public static BatchSummaryResultBuilder builder() {
            return new BatchSummaryResultBuilder();
        }

        // Getters and setters
        public List<SummaryResult> getResults() { return results; }
        public void setResults(List<SummaryResult> results) { this.results = results; }
        public int getTotalProcessed() { return totalProcessed; }
        public void setTotalProcessed(int totalProcessed) { this.totalProcessed = totalProcessed; }
        public int getSuccessCount() { return successCount; }
        public void setSuccessCount(int successCount) { this.successCount = successCount; }
        public int getErrorCount() { return errorCount; }
        public void setErrorCount(int errorCount) { this.errorCount = errorCount; }
        public LocalDateTime getCompletedAt() { return completedAt; }
        public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

        public static class BatchSummaryResultBuilder {
            private BatchSummaryResult instance = new BatchSummaryResult();
            
            public BatchSummaryResultBuilder results(List<SummaryResult> results) { instance.results = results; return this; }
            public BatchSummaryResultBuilder totalProcessed(int total) { instance.totalProcessed = total; return this; }
            public BatchSummaryResultBuilder successCount(int count) { instance.successCount = count; return this; }
            public BatchSummaryResultBuilder errorCount(int count) { instance.errorCount = count; return this; }
            public BatchSummaryResultBuilder completedAt(LocalDateTime time) { instance.completedAt = time; return this; }
            public BatchSummaryResult build() { return instance; }
        }
    }

    public static class ComprehensiveAnalysis {
        private Long noteId;
        private SummaryResult summary;
        private KeyPointsResult keyPoints;
        private InsightsResult insights;
        private LocalDateTime generatedAt;

        public static ComprehensiveAnalysisBuilder builder() {
            return new ComprehensiveAnalysisBuilder();
        }

        // Getters and setters
        public Long getNoteId() { return noteId; }
        public void setNoteId(Long noteId) { this.noteId = noteId; }
        public SummaryResult getSummary() { return summary; }
        public void setSummary(SummaryResult summary) { this.summary = summary; }
        public KeyPointsResult getKeyPoints() { return keyPoints; }
        public void setKeyPoints(KeyPointsResult keyPoints) { this.keyPoints = keyPoints; }
        public InsightsResult getInsights() { return insights; }
        public void setInsights(InsightsResult insights) { this.insights = insights; }
        public LocalDateTime getGeneratedAt() { return generatedAt; }
        public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }

        public static class ComprehensiveAnalysisBuilder {
            private ComprehensiveAnalysis instance = new ComprehensiveAnalysis();
            
            public ComprehensiveAnalysisBuilder noteId(Long noteId) { instance.noteId = noteId; return this; }
            public ComprehensiveAnalysisBuilder summary(SummaryResult summary) { instance.summary = summary; return this; }
            public ComprehensiveAnalysisBuilder keyPoints(KeyPointsResult keyPoints) { instance.keyPoints = keyPoints; return this; }
            public ComprehensiveAnalysisBuilder insights(InsightsResult insights) { instance.insights = insights; return this; }
            public ComprehensiveAnalysisBuilder generatedAt(LocalDateTime time) { instance.generatedAt = time; return this; }
            public ComprehensiveAnalysis build() { return instance; }
        }
    }

    public static class PluginStatistics {
        private String pluginId;
        private String version;
        private boolean openAIConfigured;
        private String model;
        private List<String> capabilities;
        private Map<String, Object> healthStatus;
        private LocalDateTime lastUpdated;

        public static PluginStatisticsBuilder builder() {
            return new PluginStatisticsBuilder();
        }

        // Getters and setters
        public String getPluginId() { return pluginId; }
        public void setPluginId(String pluginId) { this.pluginId = pluginId; }
        public String getVersion() { return version; }
        public void setVersion(String version) { this.version = version; }
        public boolean isOpenAIConfigured() { return openAIConfigured; }
        public void setOpenAIConfigured(boolean openAIConfigured) { this.openAIConfigured = openAIConfigured; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public List<String> getCapabilities() { return capabilities; }
        public void setCapabilities(List<String> capabilities) { this.capabilities = capabilities; }
        public Map<String, Object> getHealthStatus() { return healthStatus; }
        public void setHealthStatus(Map<String, Object> healthStatus) { this.healthStatus = healthStatus; }
        public LocalDateTime getLastUpdated() { return lastUpdated; }
        public void setLastUpdated(LocalDateTime lastUpdated) { this.lastUpdated = lastUpdated; }

        public static class PluginStatisticsBuilder {
            private PluginStatistics instance = new PluginStatistics();
            
            public PluginStatisticsBuilder pluginId(String pluginId) { instance.pluginId = pluginId; return this; }
            public PluginStatisticsBuilder version(String version) { instance.version = version; return this; }
            public PluginStatisticsBuilder openAIConfigured(boolean configured) { instance.openAIConfigured = configured; return this; }
            public PluginStatisticsBuilder model(String model) { instance.model = model; return this; }
            public PluginStatisticsBuilder capabilities(List<String> capabilities) { instance.capabilities = capabilities; return this; }
            public PluginStatisticsBuilder healthStatus(Map<String, Object> status) { instance.healthStatus = status; return this; }
            public PluginStatisticsBuilder lastUpdated(LocalDateTime time) { instance.lastUpdated = time; return this; }
            public PluginStatistics build() { return instance; }
        }
    }
}

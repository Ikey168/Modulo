package com.modulo.controller;

import com.modulo.plugin.impl.AINotesSummarizationPlugin;
import com.modulo.plugin.impl.AINotesSummarizationPlugin.*;
import com.modulo.service.OpenAIService.SummaryOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.time.LocalDateTime;

/**
 * REST API Controller for AI Notes Summarization Plugin
 */
@RestController
@RequestMapping("/api/plugin/ai-notes-summarization")
@CrossOrigin(origins = "*")
public class AINotesSummarizationController {

    @Autowired
    private AINotesSummarizationPlugin aiPlugin;

    /**
     * Generate summary for a specific note
     * POST /api/plugin/ai-notes-summarization/notes/{noteId}/summarize
     */
    @PostMapping("/notes/{noteId}/summarize")
    public ResponseEntity<SummaryResult> summarizeNote(
            @PathVariable Long noteId,
            @RequestBody(required = false) SummarizationRequest request) {
        
        SummaryOptions options = buildSummaryOptions(request);
        SummaryResult result = aiPlugin.summarizeNote(noteId, options);
        
        if (result.isSuccess()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * Extract key points from a specific note
     * POST /api/plugin/ai-notes-summarization/notes/{noteId}/key-points
     */
    @PostMapping("/notes/{noteId}/key-points")
    public ResponseEntity<KeyPointsResult> extractKeyPoints(
            @PathVariable Long noteId,
            @RequestParam(defaultValue = "5") int maxPoints) {
        
        KeyPointsResult result = aiPlugin.extractKeyPoints(noteId, maxPoints);
        
        if (result.isSuccess()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * Generate insights for a specific note
     * POST /api/plugin/ai-notes-summarization/notes/{noteId}/insights
     */
    @PostMapping("/notes/{noteId}/insights")
    public ResponseEntity<InsightsResult> generateInsights(@PathVariable Long noteId) {
        
        InsightsResult result = aiPlugin.generateInsights(noteId);
        
        if (result.isSuccess()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * Get comprehensive analysis for a note (summary + key points + insights)
     * POST /api/plugin/ai-notes-summarization/notes/{noteId}/analyze
     */
    @PostMapping("/notes/{noteId}/analyze")
    public ResponseEntity<ComprehensiveAnalysis> analyzeNote(
            @PathVariable Long noteId,
            @RequestBody(required = false) AnalysisRequest request) {
        
        SummaryOptions summaryOptions = buildSummaryOptions(request != null ? request.getSummaryRequest() : null);
        int maxKeyPoints = request != null ? request.getMaxKeyPoints() : 5;
        
        ComprehensiveAnalysis result = aiPlugin.getComprehensiveAnalysis(noteId, summaryOptions, maxKeyPoints);
        
        return ResponseEntity.ok(result);
    }

    /**
     * Batch summarize multiple notes
     * POST /api/plugin/ai-notes-summarization/notes/batch-summarize
     */
    @PostMapping("/notes/batch-summarize")
    public ResponseEntity<BatchSummaryResult> batchSummarize(@RequestBody BatchSummarizationRequest request) {
        
        if (request.getNoteIds() == null || request.getNoteIds().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        SummaryOptions options = buildSummaryOptions(request.getSummaryRequest());
        BatchSummaryResult result = aiPlugin.batchSummarizeNotes(request.getNoteIds(), options);
        
        return ResponseEntity.ok(result);
    }

    /**
     * Get plugin statistics and status
     * GET /api/plugin/ai-notes-summarization/status
     */
    @GetMapping("/status")
    public ResponseEntity<PluginStatistics> getPluginStatus() {
        PluginStatistics stats = aiPlugin.getStatistics();
        return ResponseEntity.ok(stats);
    }

    /**
     * Get plugin health check
     * GET /api/plugin/ai-notes-summarization/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealthCheck() {
        Map<String, Object> health = aiPlugin.getHealthCheck();
        return ResponseEntity.ok(health);
    }

    /**
     * Get plugin capabilities
     * GET /api/plugin/ai-notes-summarization/capabilities
     */
    @GetMapping("/capabilities")
    public ResponseEntity<Map<String, Object>> getCapabilities() {
        Map<String, Object> response = new HashMap<>();
        response.put("pluginId", aiPlugin.getId());
        response.put("name", aiPlugin.getName());
        response.put("version", aiPlugin.getVersion());
        response.put("author", aiPlugin.getAuthor());
        response.put("description", aiPlugin.getDescription());
        response.put("capabilities", aiPlugin.getCapabilities());
        response.put("lastChecked", LocalDateTime.now());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Quick summary endpoint for UI integration
     * GET /api/plugin/ai-notes-summarization/notes/{noteId}/quick-summary
     */
    @GetMapping("/notes/{noteId}/quick-summary")
    public ResponseEntity<Map<String, Object>> getQuickSummary(@PathVariable Long noteId) {
        SummaryOptions quickOptions = SummaryOptions.builder()
                .length(SummaryOptions.Length.SHORT)
                .style(SummaryOptions.Style.CASUAL)
                .build();
        
        SummaryResult result = aiPlugin.summarizeNote(noteId, quickOptions);
        
        Map<String, Object> response = new HashMap<>();
        response.put("noteId", noteId);
        response.put("success", result.isSuccess());
        
        if (result.isSuccess()) {
            response.put("summary", result.getSummary());
            response.put("compressionRatio", result.getCompressionRatio());
            response.put("model", result.getModel());
            response.put("mock", result.isMock());
        } else {
            response.put("error", result.getError());
        }
        
        return ResponseEntity.ok(response);
    }

    private SummaryOptions buildSummaryOptions(SummarizationRequest request) {
        if (request == null) {
            return SummaryOptions.builder().build();
        }
        
        SummaryOptions.SummaryOptionsBuilder builder = SummaryOptions.builder();
        
        if (request.getLength() != null) {
            builder.length(SummaryOptions.Length.valueOf(request.getLength().toUpperCase()));
        }
        
        if (request.getStyle() != null) {
            builder.style(SummaryOptions.Style.valueOf(request.getStyle().toUpperCase()));
        }
        
        if (request.getFocusAreas() != null) {
            builder.focusAreas(request.getFocusAreas());
        }
        
        if (request.getModel() != null) {
            builder.model(request.getModel());
        }
        
        if (request.getMaxTokens() != null) {
            builder.maxTokens(request.getMaxTokens());
        }
        
        if (request.getTemperature() != null) {
            builder.temperature(request.getTemperature());
        }
        
        return builder.build();
    }

    // Request DTOs
    public static class SummarizationRequest {
        private String length; // SHORT, MEDIUM, LONG
        private String style;  // FORMAL, CASUAL, TECHNICAL, ACADEMIC
        private List<String> focusAreas;
        private String model;
        private Integer maxTokens;
        private Double temperature;

        // Getters and setters
        public String getLength() { return length; }
        public void setLength(String length) { this.length = length; }
        public String getStyle() { return style; }
        public void setStyle(String style) { this.style = style; }
        public List<String> getFocusAreas() { return focusAreas; }
        public void setFocusAreas(List<String> focusAreas) { this.focusAreas = focusAreas; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public Integer getMaxTokens() { return maxTokens; }
        public void setMaxTokens(Integer maxTokens) { this.maxTokens = maxTokens; }
        public Double getTemperature() { return temperature; }
        public void setTemperature(Double temperature) { this.temperature = temperature; }
    }

    public static class AnalysisRequest {
        private SummarizationRequest summaryRequest;
        private int maxKeyPoints = 5;

        // Getters and setters
        public SummarizationRequest getSummaryRequest() { return summaryRequest; }
        public void setSummaryRequest(SummarizationRequest summaryRequest) { this.summaryRequest = summaryRequest; }
        public int getMaxKeyPoints() { return maxKeyPoints; }
        public void setMaxKeyPoints(int maxKeyPoints) { this.maxKeyPoints = maxKeyPoints; }
    }

    public static class BatchSummarizationRequest {
        private List<Long> noteIds;
        private SummarizationRequest summaryRequest;

        // Getters and setters
        public List<Long> getNoteIds() { return noteIds; }
        public void setNoteIds(List<Long> noteIds) { this.noteIds = noteIds; }
        public SummarizationRequest getSummaryRequest() { return summaryRequest; }
        public void setSummaryRequest(SummarizationRequest summaryRequest) { this.summaryRequest = summaryRequest; }
    }
}

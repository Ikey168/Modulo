package com.modulo.controller;

import com.modulo.plugin.api.renderer.NoteRenderer;
import com.modulo.plugin.api.renderer.RendererOutput;
import com.modulo.plugin.api.renderer.RendererEventResponse;
import com.modulo.plugin.api.renderer.RendererOption;
import com.modulo.plugin.registry.RendererPluginRegistry;
import com.modulo.plugin.service.RendererService;
import com.modulo.entity.Note;
import com.modulo.service.NoteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * REST Controller for note renderer operations
 */
@RestController
@RequestMapping("/api/renderers")
@CrossOrigin(origins = "*")
public class RendererController {
    
    @Autowired
    private RendererService rendererService;
    
    @Autowired
    private RendererPluginRegistry rendererRegistry;
    
    @Autowired
    private NoteService noteService;
    
    /**
     * Get all available renderers
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllRenderers() {
        try {
            Map<String, RendererPluginRegistry.RendererMetadata> metadata = 
                rendererRegistry.getAllRendererMetadata();
            
            Map<String, Object> response = new HashMap<>();
            response.put("renderers", metadata);
            response.put("count", metadata.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to get renderers: " + e.getMessage()));
        }
    }
    
    /**
     * Get renderer details by ID
     */
    @GetMapping("/{rendererId}")
    public ResponseEntity<Map<String, Object>> getRenderer(@PathVariable String rendererId) {
        try {
            NoteRenderer renderer = rendererRegistry.getRenderer(rendererId);
            if (renderer == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Collections.singletonMap("error", "Renderer not found"));
            }
            
            RendererPluginRegistry.RendererMetadata metadata = 
                rendererRegistry.getRendererMetadata(rendererId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", renderer.getRendererId());
            response.put("name", renderer.getName());
            response.put("version", renderer.getVersion());
            response.put("description", renderer.getDescription());
            response.put("supportedNoteTypes", renderer.getSupportedNoteTypes());
            response.put("metadata", metadata);
            response.put("options", renderer.getAvailableOptions());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to get renderer: " + e.getMessage()));
        }
    }
    
    /**
     * Get compatible renderers for a note
     */
    @GetMapping("/compatible/{noteId}")
    public ResponseEntity<Map<String, Object>> getCompatibleRenderers(@PathVariable Long noteId) {
        try {
            Optional<Note> noteOpt = noteService.findById(noteId);
            if (noteOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Collections.singletonMap("error", "Note not found"));
            }
            
            Note note = noteOpt.get();
            List<NoteRenderer> compatibleRenderers = rendererService.getCompatibleRenderers(note);
            
            List<Map<String, Object>> rendererInfo = new ArrayList<>();
            for (NoteRenderer renderer : compatibleRenderers) {
                Map<String, Object> info = new HashMap<>();
                info.put("id", renderer.getRendererId());
                info.put("name", renderer.getName());
                info.put("description", renderer.getDescription());
                rendererInfo.add(info);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("noteId", noteId);
            response.put("compatibleRenderers", rendererInfo);
            response.put("count", rendererInfo.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to get compatible renderers: " + e.getMessage()));
        }
    }
    
    /**
     * Render a note with a specific renderer
     */
    @PostMapping("/render")
    public ResponseEntity<Map<String, Object>> renderNote(@RequestBody Map<String, Object> request) {
        try {
            Long noteId = Long.valueOf(request.get("noteId").toString());
            String rendererId = (String) request.get("rendererId");
            
            @SuppressWarnings("unchecked")
            Map<String, Object> options = (Map<String, Object>) request.getOrDefault("options", new HashMap<>());
            
            Optional<Note> noteOpt = noteService.findById(noteId);
            if (noteOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Collections.singletonMap("error", "Note not found"));
            }
            
            // Validate options
            Map<String, String> validationErrors = rendererService.validateRendererOptions(rendererId, options);
            if (!validationErrors.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("error", "Invalid options");
                response.put("validationErrors", validationErrors);
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
            
            Note note = noteOpt.get();
            RendererOutput output = rendererService.renderNote(note, rendererId, options);
            
            if (output == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Failed to render note"));
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("content", output.getContent());
            response.put("mimeType", output.getMimeType());
            response.put("metadata", output.getMetadata());
            response.put("interactive", output.isInteractive());
            response.put("timestamp", output.getTimestamp());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to render note: " + e.getMessage()));
        }
    }
    
    /**
     * Handle renderer events
     */
    @PostMapping("/event")
    public ResponseEntity<Map<String, Object>> handleEvent(@RequestBody Map<String, Object> request) {
        try {
            String rendererId = (String) request.get("rendererId");
            String eventType = (String) request.get("eventType");
            
            @SuppressWarnings("unchecked")
            Map<String, Object> eventData = (Map<String, Object>) request.getOrDefault("eventData", new HashMap<>());
            
            @SuppressWarnings("unchecked")
            Map<String, Object> context = (Map<String, Object>) request.getOrDefault("context", new HashMap<>());
            
            RendererEventResponse eventResponse = rendererService.handleRendererEvent(
                rendererId, eventType, eventData, context);
            
            Map<String, Object> response = new HashMap<>();
            response.put("type", eventResponse.getType());
            response.put("data", eventResponse.getData());
            response.put("message", eventResponse.getMessage());
            response.put("navigationTarget", eventResponse.getNavigationTarget());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to handle event: " + e.getMessage()));
        }
    }
    
    /**
     * Get renderer options
     */
    @GetMapping("/{rendererId}/options")
    public ResponseEntity<Map<String, Object>> getRendererOptions(@PathVariable String rendererId) {
        try {
            List<RendererOption> options = rendererService.getRendererOptions(rendererId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("rendererId", rendererId);
            response.put("options", options);
            response.put("count", options.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to get renderer options: " + e.getMessage()));
        }
    }
    
    /**
     * Validate renderer options
     */
    @PostMapping("/{rendererId}/validate-options")
    public ResponseEntity<Map<String, Object>> validateOptions(
            @PathVariable String rendererId,
            @RequestBody Map<String, Object> options) {
        try {
            Map<String, String> validationErrors = rendererService.validateRendererOptions(rendererId, options);
            
            Map<String, Object> response = new HashMap<>();
            response.put("valid", validationErrors.isEmpty());
            response.put("errors", validationErrors);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to validate options: " + e.getMessage()));
        }
    }
    
    /**
     * Test if a renderer can handle specific content
     */
    @PostMapping("/{rendererId}/can-render")
    public ResponseEntity<Map<String, Object>> canRender(
            @PathVariable String rendererId,
            @RequestBody Map<String, Object> request) {
        try {
            String content = (String) request.get("content");
            String type = (String) request.get("type");
            
            boolean canRender = rendererService.canRender(rendererId, content, type);
            
            Map<String, Object> response = new HashMap<>();
            response.put("rendererId", rendererId);
            response.put("canRender", canRender);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to check render capability: " + e.getMessage()));
        }
    }
    
    /**
     * Enable/disable a renderer
     */
    @PutMapping("/{rendererId}/enabled")
    public ResponseEntity<Map<String, Object>> setRendererEnabled(
            @PathVariable String rendererId,
            @RequestBody Map<String, Object> request) {
        try {
            Boolean enabled = (Boolean) request.get("enabled");
            if (enabled == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Missing 'enabled' field"));
            }
            
            boolean success = rendererRegistry.setRendererEnabled(rendererId, enabled);
            
            Map<String, Object> response = new HashMap<>();
            response.put("rendererId", rendererId);
            response.put("enabled", enabled);
            response.put("success", success);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to update renderer status: " + e.getMessage()));
        }
    }
    
    /**
     * Get renderer statistics
     */
    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getStatistics() {
        try {
            Map<String, Object> stats = rendererService.getRendererStatistics();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to get statistics: " + e.getMessage()));
        }
    }
    
    /**
     * Get the type of a note (defaults to markdown if not specified)
     * @param note The note
     * @return The note type
     */
    private String getNoteType(Note note) {
        // For now, assume all notes are markdown
        // In the future, this could be based on note metadata, file extension, or content analysis
        return "markdown";
    }
}

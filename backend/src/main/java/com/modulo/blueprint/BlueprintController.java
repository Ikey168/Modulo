package com.modulo.blueprint;

import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import com.modulo.util.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API for blueprint CRUD (#272).
 * Blueprints are stored in plugin_registry with runtime = 'BLUEPRINT'.
 * Every PUT records a before/after snapshot in plugin_config_history.
 */
@RestController
@RequestMapping("/api/blueprints")
@PreAuthorize("isAuthenticated()")
public class BlueprintController {

    private static final Logger logger = LoggerFactory.getLogger(BlueprintController.class);

    @Autowired
    private BlueprintRepository blueprintRepository;

    @Autowired
    private BlueprintInterpreterService interpreterService;

    @GetMapping
    public ResponseEntity<List<BlueprintEntry>> listBlueprints() {
        try {
            return ResponseEntity.ok(blueprintRepository.findAll());
        } catch (Exception e) {
            logger.error("Error listing blueprints", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{name}")
    public ResponseEntity<BlueprintEntry> getBlueprint(@PathVariable String name) {
        try {
            return blueprintRepository.findByName(name)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("Error fetching blueprint: {}", LogSanitizer.sanitize(name), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    public ResponseEntity<BlueprintEntry> createBlueprint(
            @RequestBody BlueprintSaveRequest req,
            Authentication auth) {
        try {
            String actor = auth != null ? auth.getName() : "system";
            BlueprintEntry created = blueprintRepository.create(req, actor);
            interpreterService.registerBlueprint(created);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (Exception e) {
            logger.error("Error creating blueprint", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{name}")
    public ResponseEntity<BlueprintEntry> updateBlueprint(
            @PathVariable String name,
            @RequestBody BlueprintUpdateRequest req,
            Authentication auth) {
        try {
            String actor = auth != null ? auth.getName() : "system";
            return blueprintRepository.update(name, req, actor)
                .map(updated -> {
                    interpreterService.registerBlueprint(updated);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("Error updating blueprint: {}", LogSanitizer.sanitize(name), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{name}/executions")
    public ResponseEntity<List<BlueprintExecution>> getExecutions(
            @PathVariable String name,
            @RequestParam(defaultValue = "20") int limit) {
        try {
            int capped = Math.max(1, Math.min(limit, 100));
            return blueprintRepository.findByName(name)
                .map(bp -> ResponseEntity.ok(blueprintRepository.findExecutions(bp.getId(), capped)))
                .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("Error fetching blueprint executions: {}", LogSanitizer.sanitize(name), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> deleteBlueprint(@PathVariable String name) {
        try {
            if (!blueprintRepository.delete(name)) {
                return ResponseEntity.notFound().build();
            }
            interpreterService.unregisterBlueprint(name);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("Error deleting blueprint: {}", LogSanitizer.sanitize(name), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}

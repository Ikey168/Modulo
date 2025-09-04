package com.modulo.controller;

import com.modulo.chaos.ChaosConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST Controller for chaos engineering management (testing only)
 */
@RestController
@RequestMapping("/chaos")
@CrossOrigin(origins = "http://localhost:3000")
public class ChaosController {

    @Autowired
    private ChaosConfig chaosConfig;

    /**
     * Get current chaos configuration
     */
    @GetMapping("/config")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ChaosConfig.ChaosMetrics> getChaosConfig() {
        return ResponseEntity.ok(chaosConfig.getChaosMetrics());
    }

    /**
     * Test endpoint that always triggers OPA failure simulation
     */
    @GetMapping("/test/opa-failure")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> testOpaFailure() {
        if (!chaosConfig.isChaosEnabled()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Chaos engineering is not enabled"));
        }
        
        // This endpoint will be intercepted by ChaosFilter when chaos=opa_down parameter is present
        return ResponseEntity.ok(Map.of("message", "This should not be reached if chaos is working"));
    }

    /**
     * Test endpoint that always triggers Keycloak failure simulation
     */
    @GetMapping("/test/keycloak-failure")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> testKeycloakFailure() {
        if (!chaosConfig.isChaosEnabled()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Chaos engineering is not enabled"));
        }
        
        return ResponseEntity.ok(Map.of("message", "This should not be reached if chaos is working"));
    }

    /**
     * Health check endpoint for testing graceful degradation
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> chaosHealth() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "chaos_enabled", chaosConfig.isChaosEnabled(),
            "timestamp", java.time.Instant.now().toString()
        ));
    }
}

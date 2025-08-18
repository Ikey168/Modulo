package com.modulo.controller;

import com.modulo.aspect.Traced;
import com.modulo.service.ObservabilityService;
import com.modulo.service.TracingService;
import io.opentelemetry.api.trace.SpanKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/observability")
@RequiredArgsConstructor
@Slf4j
public class ObservabilityDemoController {

    private final ObservabilityService observabilityService;
    private final TracingService tracingService;
    private final Random random = new Random();

    @GetMapping("/demo/traces")
    @Traced("demo.traces.operation")
    public ResponseEntity<Map<String, Object>> demoTraces() {
        log.info("Starting trace demo operation");
        
        // Simulate a complex operation with multiple spans
        String result = tracingService.traceFunction("demo.database.query", 
            SpanKind.CLIENT,
            Map.of(
                "db.operation", "SELECT",
                "db.table", "notes",
                "db.query.complexity", "high"
            ),
            () -> {
                // Simulate database query
                try {
                    Thread.sleep(50 + random.nextInt(100));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return "query_result_" + UUID.randomUUID().toString().substring(0, 8);
            }
        );

        // Add some business logic
        tracingService.traceRunnable("demo.business.logic", () -> {
            tracingService.addAttribute("business.operation", "data_processing");
            tracingService.addEvent("processing_started");
            
            // Simulate some processing
            try {
                Thread.sleep(20 + random.nextInt(50));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            tracingService.addEvent("processing_completed", Map.of(
                "records_processed", "42",
                "processing_time_ms", "65"
            ));
        });

        // Record custom metrics
        observabilityService.recordNoteCreated("demo-note-" + UUID.randomUUID().toString().substring(0, 8), "demo-user");

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("operation", "trace_demo");
        response.put("trace_id", tracingService.getCurrentTraceId());
        response.put("span_id", tracingService.getCurrentSpanId());
        response.put("result", result);
        response.put("timestamp", System.currentTimeMillis());

        log.info("Completed trace demo operation with trace ID: {}", tracingService.getCurrentTraceId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/demo/errors")
    @Traced("demo.error.handling")
    public ResponseEntity<Map<String, Object>> demoErrorHandling(@RequestParam(defaultValue = "false") boolean shouldFail) {
        log.info("Starting error handling demo with shouldFail: {}", shouldFail);
        
        try {
            if (shouldFail) {
                // Simulate an error for observability testing
                observabilityService.recordApiError("/api/v1/observability/demo/errors", "simulation_error", "Intentional error for demo");
                throw new RuntimeException("Intentional error for observability demo");
            }

            // Simulate successful operation
            tracingService.traceRunnable("demo.successful.operation", () -> {
                tracingService.addAttribute("operation.type", "success_simulation");
                try {
                    Thread.sleep(30 + random.nextInt(70));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("operation", "error_demo");
            response.put("trace_id", tracingService.getCurrentTraceId());
            response.put("message", "Operation completed successfully");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error in demo operation: {}", e.getMessage(), e);
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("operation", "error_demo");
            errorResponse.put("trace_id", tracingService.getCurrentTraceId());
            errorResponse.put("error", e.getMessage());
            
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @GetMapping("/demo/metrics")
    @Traced("demo.metrics.collection")
    public ResponseEntity<Map<String, Object>> demoMetrics() {
        log.info("Demonstrating metrics collection");

        // Generate some demo metrics
        for (int i = 0; i < 5; i++) {
            String noteId = "demo-note-" + i;
            String userId = "demo-user-" + (i % 3);
            
            switch (i % 3) {
                case 0:
                    observabilityService.recordNoteCreated(noteId, userId);
                    break;
                case 1:
                    observabilityService.recordNoteUpdated(noteId, userId);
                    break;
                case 2:
                    observabilityService.recordNoteDeleted(noteId, userId);
                    break;
            }
        }

        // Demo WebSocket metrics
        for (int i = 0; i < 3; i++) {
            String sessionId = "demo-session-" + i;
            observabilityService.recordWebSocketConnection(sessionId);
            observabilityService.recordWebSocketMessage(sessionId, "demo_message_type");
        }

        // Demo blockchain metrics
        observabilityService.recordBlockchainTransaction("0xdemo" + random.nextInt(1000), "note_creation");

        // Demo user login
        observabilityService.recordUserLogin("demo-user-123", "google");

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("operation", "metrics_demo");
        response.put("trace_id", tracingService.getCurrentTraceId());
        response.put("metrics_generated", Map.of(
            "notes_created", 2,
            "notes_updated", 2,
            "notes_deleted", 1,
            "websocket_connections", 3,
            "websocket_messages", 3,
            "blockchain_transactions", 1,
            "user_logins", 1
        ));

        log.info("Generated demo metrics for trace: {}", tracingService.getCurrentTraceId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/demo/performance")
    @Traced("demo.performance.test")
    public ResponseEntity<Map<String, Object>> demoPerformance(@RequestParam(defaultValue = "100") int delayMs) {
        log.info("Starting performance test with delay: {}ms", delayMs);

        // Simulate variable performance for testing
        long startTime = System.currentTimeMillis();
        
        tracingService.traceRunnable("demo.performance.database_call", 
            Map.of("delay_ms", String.valueOf(delayMs)), 
            () -> {
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        );

        // Record performance metrics
        observabilityService.recordDatabaseQueryOperation("SELECT", () -> {
            try {
                Thread.sleep(20 + random.nextInt(30));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return "performance_test_result";
        });

        long endTime = System.currentTimeMillis();
        long totalTime = endTime - startTime;

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("operation", "performance_demo");
        response.put("trace_id", tracingService.getCurrentTraceId());
        response.put("requested_delay_ms", delayMs);
        response.put("actual_duration_ms", totalTime);
        response.put("timestamp", endTime);

        log.info("Completed performance test in {}ms for trace: {}", totalTime, tracingService.getCurrentTraceId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "observability-demo");
        response.put("timestamp", System.currentTimeMillis());
        response.put("trace_id", tracingService.getCurrentTraceId());
        
        return ResponseEntity.ok(response);
    }
}

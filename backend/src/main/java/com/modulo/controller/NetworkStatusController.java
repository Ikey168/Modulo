package com.modulo.controller;

import com.modulo.service.NetworkDetectionService;
import com.modulo.service.OfflineSyncService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller for network status and sync operations
 */
@RestController
@RequestMapping("/api/network")
@Slf4j
@ConditionalOnProperty(name = "app.offline.database.enabled", havingValue = "true", matchIfMissing = true)
public class NetworkStatusController {

    @Autowired(required = false)
    private NetworkDetectionService networkDetectionService;

    @Autowired(required = false)
    private OfflineSyncService offlineSyncService;

    /**
     * Get current network status and sync information
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getNetworkStatus() {
        Map<String, Object> status = new HashMap<>();
        
        if (networkDetectionService != null) {
            status.put("online", networkDetectionService.isOnline());
        } else {
            status.put("online", true); // Assume online if service not available
        }
        
        if (offlineSyncService != null) {
            status.put("syncInProgress", offlineSyncService.isSyncInProgress());
            status.put("pendingSyncCount", offlineSyncService.getPendingSyncCount());
        } else {
            status.put("syncInProgress", false);
            status.put("pendingSyncCount", 0);
        }
        
        status.put("timestamp", System.currentTimeMillis());
        
        return ResponseEntity.ok(status);
    }

    /**
     * Force a network connectivity check
     */
    @PostMapping("/check")
    public ResponseEntity<Map<String, Object>> forceNetworkCheck() {
        if (networkDetectionService != null) {
            networkDetectionService.forceNetworkCheck();
        }
        
        return getNetworkStatus();
    }

    /**
     * Force an immediate sync of offline changes
     */
    @PostMapping("/sync")
    public ResponseEntity<Map<String, String>> forceSync() {
        Map<String, String> response = new HashMap<>();
        
        if (offlineSyncService == null) {
            response.put("status", "error");
            response.put("message", "Offline sync service not available");
            return ResponseEntity.badRequest().body(response);
        }
        
        if (networkDetectionService != null && !networkDetectionService.isOnline()) {
            response.put("status", "error");
            response.put("message", "Cannot sync - network not available");
            return ResponseEntity.badRequest().body(response);
        }
        
        try {
            offlineSyncService.prioritySync();
            response.put("status", "success");
            response.put("message", "Sync started successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error starting forced sync", e);
            response.put("status", "error");
            response.put("message", "Failed to start sync: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * Get detailed sync information
     */
    @GetMapping("/sync/status")
    public ResponseEntity<Map<String, Object>> getSyncStatus() {
        Map<String, Object> status = new HashMap<>();
        
        if (offlineSyncService != null) {
            status.put("syncInProgress", offlineSyncService.isSyncInProgress());
            status.put("pendingSyncCount", offlineSyncService.getPendingSyncCount());
            
            OfflineSyncService.SyncStatus syncStatus = offlineSyncService.getSyncStatus();
            status.put("detailed", Map.of(
                "pendingSyncCount", syncStatus.pendingSyncCount,
                "lastSyncTime", syncStatus.lastSyncTime,
                "totalSyncedCount", syncStatus.totalSyncedCount
            ));
        } else {
            status.put("syncInProgress", false);
            status.put("pendingSyncCount", 0);
            status.put("detailed", null);
        }
        
        return ResponseEntity.ok(status);
    }
}

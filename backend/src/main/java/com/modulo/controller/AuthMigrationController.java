package com.modulo.controller;

import com.modulo.entity.User;
import com.modulo.entity.User.AuthProvider;
import com.modulo.entity.User.MigrationStatus;
import com.modulo.service.AuthMigrationService;
import com.modulo.repository.jpa.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST Controller for OAuth migration management
 */
@RestController
@RequestMapping("/auth/migration")
@CrossOrigin(origins = "http://localhost:3000")
public class AuthMigrationController {

    private static final Logger logger = LoggerFactory.getLogger(AuthMigrationController.class);

    @Autowired
    private AuthMigrationService authMigrationService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Get migration status for the current user
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getMigrationStatus(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) Long userId) {
        
        try {
            User user = null;
            
            if (userId != null) {
                user = userRepository.findById(userId).orElse(null);
            } else if (email != null) {
                user = userRepository.findByEmail(email).orElse(null);
            }
            
            if (user == null) {
                return ResponseEntity.notFound().build();
            }

            Map<String, Object> status = Map.of(
                "userId", user.getId(),
                "email", user.getEmail(),
                "migrationStatus", user.getMigrationStatus() != null ? user.getMigrationStatus() : MigrationStatus.NOT_MIGRATED,
                "primaryAuthProvider", user.getPrimaryAuthProvider() != null ? user.getPrimaryAuthProvider() : "None",
                "availableProviders", user.getAuthProviders(),
                "lastOAuthProvider", user.getLastOAuthProvider() != null ? user.getLastOAuthProvider() : "None",
                "migrationDate", user.getMigrationDate(),
                "lastLoginAt", user.getLastLoginAt(),
                "dualAuthEnabled", authMigrationService.isDualAuthEnabled(),
                "defaultProvider", authMigrationService.getDefaultAuthProvider()
            );

            return ResponseEntity.ok(status);
        } catch (Exception e) {
            logger.error("Error getting migration status", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get migration statistics (admin only)
     */
    @GetMapping("/statistics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getMigrationStatistics() {
        try {
            long totalUsers = userRepository.count();
            long notMigrated = userRepository.countByMigrationStatus(MigrationStatus.NOT_MIGRATED);
            long migrated = userRepository.countByMigrationStatus(MigrationStatus.MIGRATED);
            long dualAuth = userRepository.countByMigrationStatus(MigrationStatus.DUAL_AUTH);
            long conflictResolved = userRepository.countByMigrationStatus(MigrationStatus.CONFLICT_RESOLVED);
            long manualReview = userRepository.countByMigrationStatus(MigrationStatus.MANUAL_REVIEW);

            Map<String, Object> stats = Map.of(
                "totalUsers", totalUsers,
                "migrationStats", Map.of(
                    "notMigrated", notMigrated,
                    "migrated", migrated,
                    "dualAuth", dualAuth,
                    "conflictResolved", conflictResolved,
                    "manualReview", manualReview
                ),
                "migrationProgress", totalUsers > 0 ? ((double) migrated / totalUsers) * 100 : 0,
                "dualAuthEnabled", authMigrationService.isDualAuthEnabled(),
                "defaultProvider", authMigrationService.getDefaultAuthProvider()
            );

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error getting migration statistics", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get users requiring manual review (admin only)
     */
    @GetMapping("/manual-review")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<User>> getUsersRequiringManualReview() {
        try {
            List<User> users = authMigrationService.getUsersRequiringManualReview();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            logger.error("Error getting users requiring manual review", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get users in dual-auth state (admin only)
     */
    @GetMapping("/dual-auth")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<User>> getUsersInDualAuth() {
        try {
            List<User> users = authMigrationService.getUsersInDualAuth();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            logger.error("Error getting users in dual-auth state", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Resolve account conflict (admin only)
     */
    @PostMapping("/resolve-conflict")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> resolveAccountConflict(
            @RequestBody Map<String, String> request) {
        
        try {
            String email = request.get("email");
            String canonicalProviderStr = request.get("canonicalProvider");
            String canonicalSubject = request.get("canonicalSubject");

            if (email == null || canonicalProviderStr == null || canonicalSubject == null) {
                return ResponseEntity.badRequest().build();
            }

            AuthProvider canonicalProvider = AuthProvider.valueOf(canonicalProviderStr.toUpperCase());
            
            User resolvedUser = authMigrationService.resolveAccountConflict(email, canonicalProvider, canonicalSubject);

            Map<String, Object> response = Map.of(
                "success", true,
                "message", "Account conflict resolved successfully",
                "user", Map.of(
                    "id", resolvedUser.getId(),
                    "email", resolvedUser.getEmail(),
                    "primaryAuthProvider", resolvedUser.getPrimaryAuthProvider(),
                    "migrationStatus", resolvedUser.getMigrationStatus()
                )
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error resolving account conflict", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Failed to resolve conflict: " + e.getMessage()));
        }
    }

    /**
     * Force migration for a user (admin only)
     */
    @PostMapping("/force-migrate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> forceMigration(
            @RequestBody Map<String, Object> request) {
        
        try {
            Long userId = Long.valueOf(request.get("userId").toString());
            String targetProviderStr = (String) request.get("targetProvider");
            String targetSubject = (String) request.get("targetSubject");

            Optional<User> userOpt = userRepository.findById(userId);
            if (!userOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            User user = userOpt.get();
            AuthProvider targetProvider = AuthProvider.valueOf(targetProviderStr.toUpperCase());

            // Update user migration status
            user.setPrimaryAuthProvider(targetProvider);
            user.setSubjectForProvider(targetProvider, targetSubject);
            user.setMigrationStatus(MigrationStatus.MIGRATED);
            user.setMigrationDate(LocalDateTime.now());
            
            if (!user.getAuthProviders().contains(targetProvider)) {
                user.addAuthProvider(targetProvider);
            }

            userRepository.save(user);

            Map<String, Object> response = Map.of(
                "success", true,
                "message", "User migration forced successfully",
                "user", Map.of(
                    "id", user.getId(),
                    "email", user.getEmail(),
                    "primaryAuthProvider", user.getPrimaryAuthProvider(),
                    "migrationStatus", user.getMigrationStatus()
                )
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error forcing user migration", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Failed to force migration: " + e.getMessage()));
        }
    }

    /**
     * Get users by auth provider (admin only)
     */
    @GetMapping("/users-by-provider")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, List<User>>> getUsersByProvider() {
        try {
            Map<String, List<User>> usersByProvider = Map.of(
                "google", userRepository.findByAuthProvider(AuthProvider.GOOGLE),
                "azure", userRepository.findByAuthProvider(AuthProvider.AZURE),
                "keycloak", userRepository.findByAuthProvider(AuthProvider.KEYCLOAK),
                "metamask", userRepository.findByAuthProvider(AuthProvider.METAMASK)
            );

            return ResponseEntity.ok(usersByProvider);
        } catch (Exception e) {
            logger.error("Error getting users by provider", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Update migration settings (admin only)
     */
    @PostMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> updateMigrationSettings(
            @RequestBody Map<String, Object> settings) {
        
        try {
            // Note: In a real implementation, you would update configuration
            // For now, just return the current settings
            
            Map<String, Object> response = Map.of(
                "success", true,
                "message", "Migration settings updated (Note: This is a mock response)",
                "settings", Map.of(
                    "dualAuthEnabled", authMigrationService.isDualAuthEnabled(),
                    "defaultProvider", authMigrationService.getDefaultAuthProvider()
                )
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error updating migration settings", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Failed to update settings: " + e.getMessage()));
        }
    }
}

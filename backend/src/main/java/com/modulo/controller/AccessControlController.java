package com.modulo.controller;

import com.modulo.service.BlockchainAccessControlService;
import com.modulo.service.BlockchainAccessControlService.Permission;
import com.modulo.util.LogSanitizer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * REST Controller for blockchain-based access control operations
 * Handles permission management, visibility settings, and access verification
 */
@RestController
@RequestMapping("/api/access-control")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Access Control", description = "Blockchain-based access control for notes")
@CrossOrigin(origins = "*")
public class AccessControlController {

    private final BlockchainAccessControlService accessControlService;

    /**
     * Grant permission to a user for a specific note
     * POST /api/access-control/notes/{noteId}/permissions/grant
     */
    @PostMapping("/notes/{noteId}/permissions/grant")
    @Operation(summary = "Grant note access permission", 
              description = "Grant read, write, or admin permission to a user for a specific note")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Permission granted successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request parameters"),
        @ApiResponse(responseCode = "403", description = "Insufficient permissions to grant access"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Blockchain transaction failed")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> grantPermission(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            @Valid @RequestBody GrantPermissionRequest request,
            Authentication authentication) {
        
        log.info("Granting {} permission for note {} to address {} by user {}", 
                request.getPermission(), LogSanitizer.sanitizeId(noteId), 
                LogSanitizer.sanitize(request.getGranteeAddress()), 
                LogSanitizer.sanitize(authentication.getName()));

        return accessControlService.grantPermission(noteId, request.getGranteeAddress(), 
                                                   Permission.valueOf(request.getPermission().toUpperCase()), 
                                                   request.getGranterAddress())
            .thenApply(result -> {
                log.info("Permission granted successfully: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to grant permission: {}", LogSanitizer.sanitizeMessage(throwable.getMessage()));
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to grant permission: " + throwable.getMessage()));
            });
    }

    /**
     * Revoke permission from a user for a specific note
     * POST /api/access-control/notes/{noteId}/permissions/revoke
     */
    @PostMapping("/notes/{noteId}/permissions/revoke")
    @Operation(summary = "Revoke note access permission", 
              description = "Remove access permission from a user for a specific note")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Permission revoked successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request parameters"),
        @ApiResponse(responseCode = "403", description = "Insufficient permissions to revoke access"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Blockchain transaction failed")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> revokePermission(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            @Valid @RequestBody RevokePermissionRequest request,
            Authentication authentication) {
        
        log.info("Revoking permission for note {} from address {} by user {}", 
                LogSanitizer.sanitizeId(noteId), 
                LogSanitizer.sanitize(request.getGranteeAddress()), 
                LogSanitizer.sanitize(authentication.getName()));

        return accessControlService.revokePermission(noteId, request.getGranteeAddress(), 
                                                   request.getRevokerAddress())
            .thenApply(result -> {
                log.info("Permission revoked successfully: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to revoke permission: {}", LogSanitizer.sanitizeMessage(throwable.getMessage()));
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to revoke permission: " + throwable.getMessage()));
            });
    }

    /**
     * Check user's permission level for a note
     * GET /api/access-control/notes/{noteId}/permissions/check
     */
    @GetMapping("/notes/{noteId}/permissions/check")
    @Operation(summary = "Check note access permission", 
              description = "Check what permission level a user has for a specific note")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Permission check completed"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Blockchain query failed")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> checkPermission(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            @Parameter(description = "Ethereum address to check") @RequestParam String userAddress,
            Authentication authentication) {
        
        log.info("Checking permission for note {} and address {} by user {}", 
                LogSanitizer.sanitizeId(noteId), 
                LogSanitizer.sanitize(userAddress), 
                LogSanitizer.sanitize(authentication.getName()));

        return accessControlService.checkPermission(noteId, userAddress)
            .thenApply(result -> {
                log.info("Permission check completed: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to check permission: {}", LogSanitizer.sanitizeMessage(throwable.getMessage()));
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to check permission: " + throwable.getMessage()));
            });
    }

    /**
     * Set note visibility (public/private)
     * POST /api/access-control/notes/{noteId}/visibility
     */
    @PostMapping("/notes/{noteId}/visibility")
    @Operation(summary = "Set note visibility", 
              description = "Change note visibility between public and private")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Visibility changed successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request parameters"),
        @ApiResponse(responseCode = "403", description = "Only note owner can change visibility"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Blockchain transaction failed")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> setNoteVisibility(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            @Valid @RequestBody SetVisibilityRequest request,
            Authentication authentication) {
        
        log.info("Setting note {} visibility to {} by user {}", 
                LogSanitizer.sanitizeId(noteId), 
                request.isPublic() ? "public" : "private", 
                LogSanitizer.sanitize(authentication.getName()));

        return accessControlService.setNoteVisibility(noteId, request.isPublic(), request.getOwnerAddress())
            .thenApply(result -> {
                log.info("Note visibility changed successfully: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to set note visibility: {}", LogSanitizer.sanitizeMessage(throwable.getMessage()));
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to set visibility: " + throwable.getMessage()));
            });
    }

    /**
     * Get all collaborators for a note
     * GET /api/access-control/notes/{noteId}/collaborators
     */
    @GetMapping("/notes/{noteId}/collaborators")
    @Operation(summary = "Get note collaborators", 
              description = "Get list of all users with permissions on a note")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Collaborators retrieved successfully"),
        @ApiResponse(responseCode = "403", description = "Insufficient permissions to view collaborators"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Blockchain query failed")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> getNoteCollaborators(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            @Parameter(description = "Requester's Ethereum address") @RequestParam String requesterAddress,
            Authentication authentication) {
        
        log.info("Getting collaborators for note {} by user {}", 
                LogSanitizer.sanitizeId(noteId), 
                LogSanitizer.sanitize(authentication.getName()));

        return accessControlService.getNoteCollaborators(noteId, requesterAddress)
            .thenApply(result -> {
                log.info("Collaborators retrieved successfully: {} collaborators", 
                        ((Map<String, Object>) result).get("collaboratorCount"));
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to get collaborators: {}", LogSanitizer.sanitizeMessage(throwable.getMessage()));
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to get collaborators: " + throwable.getMessage()));
            });
    }

    /**
     * Enable access control for a note
     * POST /api/access-control/notes/{noteId}/enable
     */
    @PostMapping("/notes/{noteId}/enable")
    @Operation(summary = "Enable access control", 
              description = "Enable blockchain-based access control for a note")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Access control enabled successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request parameters"),
        @ApiResponse(responseCode = "403", description = "Only note owner can enable access control"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Database or blockchain operation failed")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> enableAccessControl(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            @Valid @RequestBody EnableAccessControlRequest request,
            Authentication authentication) {
        
        log.info("Enabling access control for note {} with owner {} by user {}", 
                LogSanitizer.sanitizeId(noteId), 
                LogSanitizer.sanitize(request.getOwnerAddress()), 
                LogSanitizer.sanitize(authentication.getName()));

        return accessControlService.enableAccessControl(noteId, request.getOwnerAddress())
            .thenApply(result -> {
                log.info("Access control enabled successfully: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to enable access control: {}", LogSanitizer.sanitizeMessage(throwable.getMessage()));
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to enable access control: " + throwable.getMessage()));
            });
    }

    /**
     * Get access control status for a note
     * GET /api/access-control/notes/{noteId}/status
     */
    @GetMapping("/notes/{noteId}/status")
    @Operation(summary = "Get access control status", 
              description = "Get the current access control status and settings for a note")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Status retrieved successfully"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Query failed")
    })
    public ResponseEntity<Map<String, Object>> getAccessControlStatus(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            Authentication authentication) {
        
        try {
            log.info("Getting access control status for note {} by user {}", 
                    LogSanitizer.sanitizeId(noteId), 
                    LogSanitizer.sanitize(authentication.getName()));

            // This could be enhanced to query actual blockchain state
            Map<String, Object> status = Map.of(
                "noteId", noteId,
                "accessControlEnabled", true, // This would come from database/blockchain
                "isPublic", false, // This would come from database/blockchain
                "hasCollaborators", true, // This would come from blockchain query
                "blockchainEnabled", true,
                "contractAddress", "0x1234567890123456789012345678901234567890" // From config
            );

            log.info("Access control status retrieved: {}", status);
            return ResponseEntity.ok(status);

        } catch (Exception e) {
            log.error("Failed to get access control status: {}", LogSanitizer.sanitizeMessage(e.getMessage()));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to get status: " + e.getMessage()));
        }
    }

    // Request DTOs

    @Data
    public static class GrantPermissionRequest {
        @NotBlank(message = "Grantee address is required")
        @Schema(description = "Ethereum address to grant permission to", example = "0x1234567890123456789012345678901234567890")
        private String granteeAddress;

        @NotBlank(message = "Permission level is required")
        @Schema(description = "Permission level to grant", allowableValues = {"read", "write", "admin"}, example = "read")
        private String permission;

        @NotBlank(message = "Granter address is required")
        @Schema(description = "Ethereum address of the permission granter", example = "0x0987654321098765432109876543210987654321")
        private String granterAddress;
    }

    @Data
    public static class RevokePermissionRequest {
        @NotBlank(message = "Grantee address is required")
        @Schema(description = "Ethereum address to revoke permission from", example = "0x1234567890123456789012345678901234567890")
        private String granteeAddress;

        @NotBlank(message = "Revoker address is required")
        @Schema(description = "Ethereum address of the permission revoker", example = "0x0987654321098765432109876543210987654321")
        private String revokerAddress;
    }

    @Data
    public static class SetVisibilityRequest {
        @NotNull(message = "Public flag is required")
        @Schema(description = "Whether the note should be publicly readable", example = "true")
        private boolean isPublic;

        @NotBlank(message = "Owner address is required")
        @Schema(description = "Ethereum address of the note owner", example = "0x0987654321098765432109876543210987654321")
        private String ownerAddress;
    }

    @Data
    public static class EnableAccessControlRequest {
        @NotBlank(message = "Owner address is required")
        @Schema(description = "Ethereum address of the note owner", example = "0x0987654321098765432109876543210987654321")
        private String ownerAddress;
    }
}

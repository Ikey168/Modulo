package com.modulo.controller;

import com.modulo.service.BlockchainService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * REST Controller for blockchain operations
 * Provides endpoints for note registration, verification, and management on blockchain
 */
@Slf4j
@RestController
@RequestMapping("/api/blockchain")
@RequiredArgsConstructor
@Tag(name = "Blockchain", description = "Blockchain integration for note integrity verification")
public class BlockchainController {

    private final BlockchainService blockchainService;

    /**
     * Get blockchain network information and connection status
     */
    @GetMapping("/status")
    @Operation(summary = "Get blockchain network status", 
               description = "Returns information about blockchain connectivity and network details")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Network status retrieved successfully"),
        @ApiResponse(responseCode = "503", description = "Blockchain service unavailable")
    })
    public ResponseEntity<?> getNetworkStatus() {
        try {
            var networkInfo = blockchainService.getNetworkInfo();
            
            if (!networkInfo.isConnected()) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                        "connected", false,
                        "error", "Blockchain service unavailable"
                    ));
            }
            
            return ResponseEntity.ok(networkInfo);
        } catch (Exception e) {
            log.error("Failed to get network status: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                    "connected", false,
                    "error", e.getMessage()
                ));
        }
    }

    /**
     * Register a note on the blockchain
     */
    @PostMapping("/notes/register")
    @Operation(summary = "Register note on blockchain", 
               description = "Registers a note hash and title on the blockchain for integrity verification")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Note registered successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request or note already exists"),
        @ApiResponse(responseCode = "503", description = "Blockchain service unavailable")
    })
    public CompletableFuture<ResponseEntity<?>> registerNote(
            @Valid @RequestBody NoteRegistrationRequest request,
            Authentication authentication) {
        
        log.info("User {} requesting note registration", authentication.getName());
        
        if (!blockchainService.isAvailable()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Blockchain service unavailable"))
            );
        }

        return blockchainService.registerNote(request.getContent(), request.getTitle())
            .thenApply(result -> {
                if (result.isSuccess()) {
                    log.info("Note registered successfully with ID: {}", result.getNoteId());
                    return ResponseEntity.ok(result);
                } else {
                    log.error("Failed to register note: {}", result.getError());
                    return ResponseEntity.badRequest()
                        .body(Map.of("error", result.getError()));
                }
            })
            .exceptionally(throwable -> {
                log.error("Exception during note registration: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + throwable.getMessage()));
            });
    }

    /**
     * Verify a note on the blockchain
     */
    @PostMapping("/notes/verify")
    @Operation(summary = "Verify note on blockchain", 
               description = "Verifies if a note exists on the blockchain and checks ownership")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Note verification completed"),
        @ApiResponse(responseCode = "400", description = "Invalid request"),
        @ApiResponse(responseCode = "503", description = "Blockchain service unavailable")
    })
    public CompletableFuture<ResponseEntity<?>> verifyNote(
            @Valid @RequestBody NoteVerificationRequest request,
            Authentication authentication) {
        
        log.debug("User {} requesting note verification", authentication.getName());
        
        if (!blockchainService.isAvailable()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Blockchain service unavailable"))
            );
        }

        return blockchainService.verifyNote(request.getContent())
            .thenApply(result -> {
                if (result.getError() != null) {
                    log.error("Failed to verify note: {}", result.getError());
                    return ResponseEntity.badRequest()
                        .body(Map.of("error", result.getError()));
                } else {
                    return ResponseEntity.ok(result);
                }
            })
            .exceptionally(throwable -> {
                log.error("Exception during note verification: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + throwable.getMessage()));
            });
    }

    /**
     * Get note details by ID
     */
    @GetMapping("/notes/{noteId}")
    @Operation(summary = "Get note details by ID", 
               description = "Retrieves detailed information about a note from the blockchain")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Note details retrieved successfully"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "503", description = "Blockchain service unavailable")
    })
    public CompletableFuture<ResponseEntity<?>> getNoteById(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            Authentication authentication) {
        
        log.debug("User {} requesting note details for ID: {}", authentication.getName(), noteId);
        
        if (!blockchainService.isAvailable()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Blockchain service unavailable"))
            );
        }

        return blockchainService.getNoteById(noteId)
            .thenApply(noteOptional -> {
                if (noteOptional.isPresent()) {
                    return ResponseEntity.ok(noteOptional.get());
                } else {
                    return ResponseEntity.notFound().build();
                }
            })
            .exceptionally(throwable -> {
                log.error("Exception getting note details: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + throwable.getMessage()));
            });
    }

    /**
     * Get notes owned by the current user
     */
    @GetMapping("/notes/my-notes")
    @Operation(summary = "Get user's notes", 
               description = "Retrieves all notes owned by the current user on the blockchain")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "User notes retrieved successfully"),
        @ApiResponse(responseCode = "503", description = "Blockchain service unavailable")
    })
    public CompletableFuture<ResponseEntity<?>> getMyNotes(Authentication authentication) {
        
        log.debug("User {} requesting their notes", authentication.getName());
        
        if (!blockchainService.isAvailable()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Blockchain service unavailable"))
            );
        }

        return blockchainService.getMyNotes()
            .thenApply(noteIds -> ResponseEntity.ok(Map.of(
                "noteIds", noteIds,
                "count", noteIds.size()
            )))
            .exceptionally(throwable -> {
                log.error("Exception getting user notes: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + throwable.getMessage()));
            });
    }

    /**
     * Get total number of registered notes
     */
    @GetMapping("/notes/count")
    @Operation(summary = "Get total note count", 
               description = "Returns the total number of notes registered on the blockchain")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Note count retrieved successfully"),
        @ApiResponse(responseCode = "503", description = "Blockchain service unavailable")
    })
    public CompletableFuture<ResponseEntity<?>> getTotalNoteCount() {
        
        if (!blockchainService.isAvailable()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Blockchain service unavailable"))
            );
        }

        return blockchainService.getTotalNoteCount()
            .thenApply(count -> ResponseEntity.ok(Map.of("totalNotes", count)))
            .exceptionally(throwable -> {
                log.error("Exception getting total note count: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + throwable.getMessage()));
            });
    }

    /**
     * Update a note's content (owner only)
     */
    @PutMapping("/notes/{noteId}")
    @Operation(summary = "Update note content", 
               description = "Updates the content of a note on the blockchain (owner only)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Note updated successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request or unauthorized"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "503", description = "Blockchain service unavailable")
    })
    public CompletableFuture<ResponseEntity<?>> updateNote(
            @Parameter(description = "Note ID") @PathVariable Long noteId,
            @Valid @RequestBody NoteUpdateRequest request,
            Authentication authentication) {
        
        log.info("User {} requesting update for note ID: {}", authentication.getName(), noteId);
        
        if (!blockchainService.isAvailable()) {
            return CompletableFuture.completedFuture(
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Blockchain service unavailable"))
            );
        }

        return blockchainService.updateNote(noteId, request.getNewContent())
            .thenApply(result -> {
                if (result.isSuccess()) {
                    log.info("Note updated successfully. Transaction: {}", result.getTransactionHash());
                    return ResponseEntity.ok(result);
                } else {
                    log.error("Failed to update note: {}", result.getError());
                    return ResponseEntity.badRequest()
                        .body(Map.of("error", result.getError()));
                }
            })
            .exceptionally(throwable -> {
                log.error("Exception during note update: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + throwable.getMessage()));
            });
    }

    /**
     * Generate hash for note content (utility endpoint)
     */
    @PostMapping("/hash")
    @Operation(summary = "Generate note hash", 
               description = "Generates a hash for note content for client-side verification")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Hash generated successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request")
    })
    public ResponseEntity<?> generateHash(@Valid @RequestBody HashRequest request) {
        try {
            String hash = blockchainService.generateNoteHash(request.getContent());
            return ResponseEntity.ok(Map.of(
                "content", request.getContent(),
                "hash", hash
            ));
        } catch (Exception e) {
            log.error("Failed to generate hash: {}", e.getMessage());
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Failed to generate hash: " + e.getMessage()));
        }
    }
}

// Request/Response DTOs

@lombok.Data
class NoteRegistrationRequest {
    @NotBlank(message = "Content cannot be blank")
    private String content;
    
    @NotBlank(message = "Title cannot be blank")
    private String title;
}

@lombok.Data
class NoteVerificationRequest {
    @NotBlank(message = "Content cannot be blank")
    private String content;
}

@lombok.Data
class NoteUpdateRequest {
    @NotBlank(message = "New content cannot be blank")
    private String newContent;
}

@lombok.Data
class HashRequest {
    @NotBlank(message = "Content cannot be blank")
    private String content;
}

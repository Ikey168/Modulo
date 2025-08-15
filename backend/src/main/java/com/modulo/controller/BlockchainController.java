package com.modulo.controller;

import com.modulo.service.BlockchainService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * REST Controller for blockchain operations
 * Provides endpoints for note registration, verification, and management on blockchain
 */
@RestController
@RequestMapping("/api/blockchain")
@RequiredArgsConstructor
@Tag(name = "Blockchain", description = "Blockchain operations for note management")
public class BlockchainController {

    private static final Logger log = LoggerFactory.getLogger(BlockchainController.class);

    private final BlockchainService blockchainService;

    @PostMapping("/notes/register")
    @Operation(summary = "Register a note on blockchain", description = "Registers a note on the blockchain for integrity verification")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Note registered successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request"),
        @ApiResponse(responseCode = "500", description = "Service unavailable")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> registerNote(
            @Valid @RequestBody NoteRegistrationRequest request,
            Authentication authentication) {
        
        log.info("Registering note for user: {}", authentication.getName());

        return blockchainService.registerNote(request.getContent(), request.getTitle(), authentication.getName())
            .thenApply(result -> {
                log.info("Note registered successfully: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to register note: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to register note: " + throwable.getMessage()));
            });
    }

    @PostMapping("/notes/verify")
    @Operation(summary = "Verify note existence", description = "Verifies if a note exists on blockchain and checks ownership")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Verification completed"),
        @ApiResponse(responseCode = "400", description = "Invalid request"),
        @ApiResponse(responseCode = "500", description = "Service unavailable")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> verifyNote(
            @Valid @RequestBody NoteVerificationRequest request,
            Authentication authentication) {
        
        log.info("Verifying note for user: {}", authentication.getName());

        return blockchainService.verifyNote(request.getContent(), authentication.getName())
            .thenApply(result -> {
                log.info("Note verification completed: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to verify note: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to verify note: " + throwable.getMessage()));
            });
    }

    @PostMapping("/notes/verify-integrity")
    @Operation(summary = "Verify note integrity", description = "Compares current note content with blockchain hash to verify integrity")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Integrity verification completed"),
        @ApiResponse(responseCode = "400", description = "Invalid request"),
        @ApiResponse(responseCode = "404", description = "Note not found on blockchain"),
        @ApiResponse(responseCode = "500", description = "Service unavailable")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> verifyNoteIntegrity(
            @Valid @RequestBody NoteIntegrityRequest request,
            Authentication authentication) {
        
        log.info("Verifying note integrity for user: {}, noteId: {}", authentication.getName(), request.getNoteId());

        return blockchainService.verifyNoteIntegrity(request.getNoteId(), request.getCurrentContent(), authentication.getName())
            .thenApply(result -> {
                log.info("Note integrity verification completed: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to verify note integrity: {}", throwable.getMessage());
                if (throwable.getMessage().contains("not found")) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Note not found on blockchain"));
                }
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to verify note integrity: " + throwable.getMessage()));
            });
    }

    @GetMapping("/notes/{id}")
    @Operation(summary = "Get note by ID", description = "Retrieves note details by blockchain ID")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Note found"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Service unavailable")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> getNoteById(
            @PathVariable Long id,
            Authentication authentication) {
        
        log.info("Getting note {} for user: {}", id, authentication.getName());

        return blockchainService.getNoteById(id, authentication.getName())
            .thenApply(result -> {
                log.info("Retrieved note: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to get note: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to get note: " + throwable.getMessage()));
            });
    }

    @GetMapping("/notes/my-notes")
    @Operation(summary = "Get user's notes", description = "Retrieves all notes for the current user")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Notes retrieved"),
        @ApiResponse(responseCode = "500", description = "Service unavailable")
    })
    public CompletableFuture<ResponseEntity<List<Map<String, Object>>>> getMyNotes(Authentication authentication) {
        
        log.info("Getting all notes for user: {}", authentication.getName());

        return blockchainService.getUserNotes(authentication.getName())
            .thenApply(result -> {
                log.info("Retrieved {} notes for user", result.size());
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to get user notes: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .<List<Map<String, Object>>>body(null);
            });
    }

    @GetMapping("/notes/count")
    @Operation(summary = "Get total note count", description = "Gets the total number of notes registered on blockchain")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Count retrieved"),
        @ApiResponse(responseCode = "500", description = "Service unavailable")
    })
    public CompletableFuture<ResponseEntity<Map<String, Long>>> getTotalNoteCount() {
        
        log.info("Getting total note count");

        return blockchainService.getTotalNoteCount()
            .thenApply(count -> {
                log.info("Total note count: {}", count);
                return ResponseEntity.ok(Map.of("totalCount", count));
            })
            .exceptionally(throwable -> {
                log.error("Failed to get note count: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .<Map<String, Long>>body(null);
            });
    }

    @PutMapping("/notes/{id}")
    @Operation(summary = "Update note", description = "Updates note content on blockchain")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Note updated"),
        @ApiResponse(responseCode = "400", description = "Invalid request"),
        @ApiResponse(responseCode = "403", description = "Not authorized"),
        @ApiResponse(responseCode = "404", description = "Note not found"),
        @ApiResponse(responseCode = "500", description = "Service unavailable")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> updateNote(
            @PathVariable Long id,
            @Valid @RequestBody NoteUpdateRequest request,
            Authentication authentication) {
        
        log.info("Updating note {} for user: {}", id, authentication.getName());

        return blockchainService.updateNote(id, request.getNewContent(), authentication.getName())
            .thenApply(result -> {
                log.info("Note updated successfully: {}", result);
                return ResponseEntity.ok(result);
            })
            .exceptionally(throwable -> {
                log.error("Failed to update note: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update note: " + throwable.getMessage()));
            });
    }

    @GetMapping("/status")
    @Operation(summary = "Get blockchain status", description = "Checks blockchain network connectivity and status")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Status retrieved"),
        @ApiResponse(responseCode = "500", description = "Service unavailable")
    })
    public CompletableFuture<ResponseEntity<Map<String, Object>>> getNetworkStatus() {
        
        log.info("Checking blockchain network status");

        return blockchainService.getNetworkStatus()
            .thenApply(status -> {
                log.info("Network status: {}", status);
                return ResponseEntity.ok(status);
            })
            .exceptionally(throwable -> {
                log.error("Failed to get network status: {}", throwable.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to get network status: " + throwable.getMessage()));
            });
    }

    @PostMapping("/hash")
    @Operation(summary = "Generate content hash", description = "Generates a hash for given content")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Hash generated"),
        @ApiResponse(responseCode = "400", description = "Invalid request")
    })
    public ResponseEntity<Map<String, String>> generateHash(@Valid @RequestBody HashRequest request) {
        try {
            String hash = blockchainService.generateContentHash(request.getContent());
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
class NoteIntegrityRequest {
    @javax.validation.constraints.NotNull(message = "Note ID cannot be null")
    private Long noteId;
    
    @NotBlank(message = "Current content cannot be blank")
    private String currentContent;
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

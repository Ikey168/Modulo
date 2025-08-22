package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import com.modulo.service.IpfsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * REST Controller for IPFS-related operations
 * Handles uploading notes to IPFS and retrieving decentralized content
 */
@RestController
@RequestMapping("/api/ipfs")
@CrossOrigin(origins = "*")
public class IpfsController {

    private static final Logger logger = LoggerFactory.getLogger(IpfsController.class);

    private final IpfsService ipfsService;
    private final NoteRepository noteRepository;

    @Autowired
    public IpfsController(IpfsService ipfsService, NoteRepository noteRepository) {
        this.ipfsService = ipfsService;
        this.noteRepository = noteRepository;
    }

    /**
     * Upload a note to IPFS
     * POST /api/ipfs/notes/{noteId}/upload
     */
    @PostMapping("/notes/{noteId}/upload")
    public ResponseEntity<Map<String, Object>> uploadNoteToIpfs(@PathVariable Long noteId) {
        try {
            Optional<Note> noteOpt = noteRepository.findById(noteId);
            if (!noteOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            Note note = noteOpt.get();
            String ipfsCid = ipfsService.uploadNoteToIpfs(note);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("noteId", noteId);
            response.put("ipfsCid", ipfsCid);
            response.put("gatewayUrl", ipfsService.getGatewayUrl(ipfsCid));
            
            logger.info("Successfully uploaded note {} to IPFS with CID: {}", noteId, ipfsCid);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Failed to upload note {} to IPFS: {}", noteId, e.getMessage());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Retrieve note content from IPFS
     * GET /api/ipfs/content/{cid}
     */
    @GetMapping("/content/{cid}")
    public ResponseEntity<Map<String, Object>> getContentFromIpfs(@PathVariable String cid) {
        try {
            String content = ipfsService.retrieveContentFromIpfs(cid);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("cid", cid);
            response.put("content", content);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Failed to retrieve content from IPFS CID {}: {}", cid, e.getMessage());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        }
    }

    /**
     * Verify note integrity using IPFS
     * POST /api/ipfs/notes/{noteId}/verify
     */
    @PostMapping("/notes/{noteId}/verify")
    public ResponseEntity<Map<String, Object>> verifyNoteIntegrity(@PathVariable Long noteId) {
        try {
            Optional<Note> noteOpt = noteRepository.findById(noteId);
            if (!noteOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            Note note = noteOpt.get();
            if (note.getIpfsCid() == null) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("error", "Note is not stored on IPFS");
                return ResponseEntity.badRequest().body(errorResponse);
            }

            boolean isValid = ipfsService.verifyNoteIntegrity(note);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("noteId", noteId);
            response.put("ipfsCid", note.getIpfsCid());
            response.put("isValid", isValid);
            response.put("contentHash", note.getContentHash());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Failed to verify note {} integrity: {}", noteId, e.getMessage());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Get IPFS node status and information
     * GET /api/ipfs/status
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getIpfsStatus() {
        try {
            Map<String, Object> status = ipfsService.getNodeStatus();
            return ResponseEntity.ok(status);
            
        } catch (Exception e) {
            logger.error("Failed to get IPFS status: {}", e.getMessage());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("enabled", false);
            errorResponse.put("error", e.getMessage());
            
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(errorResponse);
        }
    }

    /**
     * Get all notes that are stored on IPFS
     * GET /api/ipfs/notes
     */
    @GetMapping("/notes")
    public ResponseEntity<Map<String, Object>> getDecentralizedNotes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Map<String, Object> result = ipfsService.getDecentralizedNotes(page, size);
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            logger.error("Failed to get decentralized notes: {}", e.getMessage());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
}

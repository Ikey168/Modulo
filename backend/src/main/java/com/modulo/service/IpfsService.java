package com.modulo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.ipfs.api.IPFS;
import io.ipfs.api.MerkleNode;
import io.ipfs.api.NamedStreamable;
import io.ipfs.multihash.Multihash;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for interacting with IPFS (InterPlanetary File System)
 * Handles uploading notes to IPFS and retrieving content by CID
 */
@Service
public class IpfsService {

    private static final Logger logger = LoggerFactory.getLogger(IpfsService.class);

    @Value("${modulo.integrations.ipfs.node-url:http://localhost:5001}")
    private String ipfsNodeUrl;

    @Value("${modulo.integrations.ipfs.gateway-url:http://localhost:8080}")
    private String ipfsGatewayUrl;

    @Value("${modulo.integrations.ipfs.enabled:true}")
    private boolean ipfsEnabled;

    private IPFS ipfs;
    private ObjectMapper objectMapper;

    @PostConstruct
    public void initialize() {
        this.objectMapper = new ObjectMapper();
        
        if (ipfsEnabled) {
            try {
                // Parse IPFS node URL to extract host and port
                String host = "localhost";
                int port = 5001;
                
                if (ipfsNodeUrl.startsWith("http://")) {
                    String urlPart = ipfsNodeUrl.substring(7);
                    String[] parts = urlPart.split(":");
                    host = parts[0];
                    if (parts.length > 1) {
                        port = Integer.parseInt(parts[1]);
                    }
                }
                
                this.ipfs = new IPFS(host, port);
                
                // Test connection
                String version = ipfs.version();
                logger.info("Connected to IPFS node version: {}", version);
                
            } catch (Exception e) {
                logger.error("Failed to connect to IPFS node: {}", e.getMessage());
                logger.warn("IPFS functionality will be disabled");
                this.ipfsEnabled = false;
            }
        } else {
            logger.info("IPFS is disabled by configuration");
        }
    }

    /**
     * Upload note content to IPFS
     * @param title Note title
     * @param content Note content
     * @param markdownContent Note markdown content
     * @param metadata Additional metadata
     * @return IPFS CID (Content Identifier)
     * @throws IOException if upload fails
     */
    public String uploadNote(String title, String content, String markdownContent, Map<String, String> metadata) throws IOException {
        if (!ipfsEnabled) {
            throw new IllegalStateException("IPFS is not enabled or not available");
        }

        // Create note metadata structure
        Map<String, Object> noteData = new HashMap<>();
        noteData.put("title", title);
        noteData.put("content", content);
        noteData.put("markdownContent", markdownContent);
        noteData.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        noteData.put("metadata", metadata != null ? metadata : new HashMap<>());
        noteData.put("version", "1.0");
        noteData.put("type", "modulo-note");

        // Convert to JSON
        String jsonContent = objectMapper.writeValueAsString(noteData);
        
        // Upload to IPFS
        NamedStreamable.ByteArrayWrapper file = new NamedStreamable.ByteArrayWrapper(
            "note.json", 
            jsonContent.getBytes(StandardCharsets.UTF_8)
        );

        try {
            List<MerkleNode> result = ipfs.add(file);
            String cid = result.get(0).hash.toString();
            
            logger.info("Successfully uploaded note to IPFS with CID: {}", cid);
            return cid;
            
        } catch (Exception e) {
            logger.error("Failed to upload note to IPFS: {}", e.getMessage());
            throw new IOException("Failed to upload to IPFS: " + e.getMessage(), e);
        }
    }

    /**
     * Retrieve note content from IPFS by CID
     * @param cid IPFS Content Identifier
     * @return Map containing note data
     * @throws IOException if retrieval fails
     */
    public Map<String, Object> retrieveNote(String cid) throws IOException {
        if (!ipfsEnabled) {
            throw new IllegalStateException("IPFS is not enabled or not available");
        }

        try {
            Multihash hash = Multihash.fromBase58(cid);
            byte[] content = ipfs.cat(hash);
            String jsonContent = new String(content, StandardCharsets.UTF_8);
            
            // Parse JSON content
            JsonNode jsonNode = objectMapper.readTree(jsonContent);
            Map<String, Object> noteData = objectMapper.convertValue(jsonNode, Map.class);
            
            logger.info("Successfully retrieved note from IPFS with CID: {}", cid);
            return noteData;
            
        } catch (Exception e) {
            logger.error("Failed to retrieve note from IPFS with CID {}: {}", cid, e.getMessage());
            throw new IOException("Failed to retrieve from IPFS: " + e.getMessage(), e);
        }
    }

    /**
     * Calculate SHA-256 hash of note content for blockchain storage
     * @param title Note title
     * @param content Note content
     * @return SHA-256 hash as hex string
     */
    public String calculateContentHash(String title, String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String combinedContent = title + "|" + content;
            byte[] hash = digest.digest(combinedContent.getBytes(StandardCharsets.UTF_8));
            
            // Convert to hex string
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
            
        } catch (NoSuchAlgorithmException e) {
            logger.error("SHA-256 algorithm not available: {}", e.getMessage());
            throw new RuntimeException("Failed to calculate content hash", e);
        }
    }

    /**
     * Pin content to IPFS to ensure it stays available
     * @param cid Content Identifier to pin
     * @return true if pinning was successful
     */
    public boolean pinContent(String cid) {
        if (!ipfsEnabled) {
            logger.warn("IPFS is not enabled, cannot pin content");
            return false;
        }

        try {
            Multihash hash = Multihash.fromBase58(cid);
            List<Multihash> pinned = ipfs.pin.add(hash);
            
            boolean success = pinned.contains(hash);
            if (success) {
                logger.info("Successfully pinned content with CID: {}", cid);
            } else {
                logger.warn("Failed to pin content with CID: {}", cid);
            }
            
            return success;
            
        } catch (Exception e) {
            logger.error("Error pinning content with CID {}: {}", cid, e.getMessage());
            return false;
        }
    }

    /**
     * Unpin content from IPFS
     * @param cid Content Identifier to unpin
     * @return true if unpinning was successful
     */
    public boolean unpinContent(String cid) {
        if (!ipfsEnabled) {
            logger.warn("IPFS is not enabled, cannot unpin content");
            return false;
        }

        try {
            Multihash hash = Multihash.fromBase58(cid);
            List<Multihash> unpinned = ipfs.pin.rm(hash);
            
            boolean success = unpinned.contains(hash);
            if (success) {
                logger.info("Successfully unpinned content with CID: {}", cid);
            } else {
                logger.warn("Failed to unpin content with CID: {}", cid);
            }
            
            return success;
            
        } catch (Exception e) {
            logger.error("Error unpinning content with CID {}: {}", cid, e.getMessage());
            return false;
        }
    }

    /**
     * Get IPFS gateway URL for a given CID
     * @param cid Content Identifier
     * @return Full gateway URL
     */
    public String getGatewayUrl(String cid) {
        return ipfsGatewayUrl + "/ipfs/" + cid;
    }

    /**
     * Check if IPFS service is available
     * @return true if IPFS is enabled and accessible
     */
    public boolean isAvailable() {
        if (!ipfsEnabled) {
            return false;
        }

        try {
            // Try to get IPFS version as a health check
            ipfs.version();
            return true;
        } catch (Exception e) {
            logger.warn("IPFS health check failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Get IPFS node information
     * @return Map containing node information
     */
    public Map<String, Object> getNodeInfo() throws IOException {
        if (!ipfsEnabled) {
            throw new IllegalStateException("IPFS is not enabled or not available");
        }

        try {
            Map<String, Object> nodeInfo = new HashMap<>();
            nodeInfo.put("version", ipfs.version());
            nodeInfo.put("nodeUrl", ipfsNodeUrl);
            nodeInfo.put("gatewayUrl", ipfsGatewayUrl);
            nodeInfo.put("enabled", ipfsEnabled);
            
            return nodeInfo;
            
        } catch (Exception e) {
            logger.error("Failed to get IPFS node info: {}", e.getMessage());
            throw new IOException("Failed to get node info: " + e.getMessage(), e);
        }
    }

    /**
     * Validate CID format
     * @param cid Content Identifier to validate
     * @return true if CID is valid
     */
    public boolean isValidCid(String cid) {
        if (cid == null || cid.trim().isEmpty()) {
            return false;
        }

        try {
            Multihash.fromBase58(cid);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Get IPFS node status and information
     * @return Map containing node status information
     */
    public Map<String, Object> getNodeStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("enabled", ipfsEnabled);

        if (!ipfsEnabled) {
            status.put("status", "disabled");
            return status;
        }

        try {
            String version = ipfs.version();
            status.put("status", "connected");
            status.put("version", version);
            status.put("nodeUrl", ipfsNodeUrl);
            status.put("gatewayUrl", ipfsGatewayUrl);
        } catch (Exception e) {
            status.put("status", "disconnected");
            status.put("error", e.getMessage());
        }

        return status;
    }

    /**
     * Get all decentralized notes with pagination
     * @param page Page number (0-based)
     * @param size Page size
     * @return Map containing paginated results
     */
    public Map<String, Object> getDecentralizedNotes(int page, int size) {
        // This would require injecting the NoteRepository
        // For now, return placeholder response
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("page", page);
        result.put("size", size);
        result.put("notes", new ArrayList<>());
        result.put("totalElements", 0);
        result.put("totalPages", 0);
        
        logger.warn("getDecentralizedNotes method needs NoteRepository injection for full implementation");
        
        return result;
    }
}

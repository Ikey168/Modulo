package com.modulo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.model.Note;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.mime.MultipartEntityBuilder;
import org.apache.http.entity.mime.content.StringBody;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
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

    private CloseableHttpClient httpClient;
    private ObjectMapper objectMapper;

    @PostConstruct
    public void initialize() {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClients.createDefault();
        
        if (ipfsEnabled) {
            try {
                // Test IPFS node connection
                testConnection();
                logger.info("Connected to IPFS node at: {}", ipfsNodeUrl);
                
            } catch (Exception e) {
                logger.error("Failed to connect to IPFS node: {}", e.getMessage());
                logger.warn("IPFS functionality will be disabled");
                this.ipfsEnabled = false;
            }
        } else {
            logger.info("IPFS is disabled by configuration");
        }
    }

    private void testConnection() throws IOException {
        HttpGet request = new HttpGet(ipfsNodeUrl + "/api/v0/version");
        try (CloseableHttpClient client = HttpClients.createDefault()) {
            HttpResponse response = client.execute(request);
            if (response.getStatusLine().getStatusCode() != 200) {
                throw new IOException("IPFS node not responding properly");
            }
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
        
        // Upload to IPFS using HTTP API
        HttpPost request = new HttpPost(ipfsNodeUrl + "/api/v0/add");
        
        HttpEntity entity = MultipartEntityBuilder.create()
                .addPart("file", new StringBody(jsonContent, org.apache.http.entity.ContentType.APPLICATION_JSON))
                .build();
        
        request.setEntity(entity);

        try {
            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());
            
            if (response.getStatusLine().getStatusCode() != 200) {
                throw new IOException("IPFS upload failed: " + responseBody);
            }
            
            // Parse response to get CID
            JsonNode responseJson = objectMapper.readTree(responseBody);
            String cid = responseJson.get("Hash").asText();
            
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

        HttpGet request = new HttpGet(ipfsNodeUrl + "/api/v0/cat?arg=" + cid);

        try {
            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());
            
            if (response.getStatusLine().getStatusCode() != 200) {
                throw new IOException("IPFS retrieval failed: " + responseBody);
            }
            
            // Parse JSON content
            JsonNode jsonNode = objectMapper.readTree(responseBody);
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
            HttpPost request = new HttpPost(ipfsNodeUrl + "/api/v0/pin/add?arg=" + cid);
            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());
            
            boolean success = response.getStatusLine().getStatusCode() == 200;
            if (success) {
                logger.info("Successfully pinned content with CID: {}", cid);
            } else {
                logger.warn("Failed to pin content with CID: {}, response: {}", cid, responseBody);
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
            HttpPost request = new HttpPost(ipfsNodeUrl + "/api/v0/pin/rm?arg=" + cid);
            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());
            
            boolean success = response.getStatusLine().getStatusCode() == 200;
            if (success) {
                logger.info("Successfully unpinned content with CID: {}", cid);
            } else {
                logger.warn("Failed to unpin content with CID: {}, response: {}", cid, responseBody);
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
            HttpGet request = new HttpGet(ipfsNodeUrl + "/api/v0/version");
            HttpResponse response = httpClient.execute(request);
            return response.getStatusLine().getStatusCode() == 200;
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
            HttpGet request = new HttpGet(ipfsNodeUrl + "/api/v0/version");
            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());
            
            Map<String, Object> nodeInfo = new HashMap<>();
            if (response.getStatusLine().getStatusCode() == 200) {
                JsonNode versionInfo = objectMapper.readTree(responseBody);
                nodeInfo.put("version", versionInfo.get("Version").asText());
            } else {
                nodeInfo.put("version", "unknown");
            }
            
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
     * Validate CID format (basic validation)
     * @param cid Content Identifier to validate
     * @return true if CID is valid
     */
    public boolean isValidCid(String cid) {
        if (cid == null || cid.trim().isEmpty()) {
            return false;
        }

        // Basic CID validation - starts with Qm (v0) or b (v1) and proper length
        cid = cid.trim();
        return (cid.startsWith("Qm") && cid.length() == 46) || 
               (cid.startsWith("b") && cid.length() > 50);
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
            HttpGet request = new HttpGet(ipfsNodeUrl + "/api/v0/version");
            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());
            
            if (response.getStatusLine().getStatusCode() == 200) {
                JsonNode versionInfo = objectMapper.readTree(responseBody);
                status.put("status", "connected");
                status.put("version", versionInfo.get("Version").asText());
            } else {
                status.put("status", "disconnected");
                status.put("error", "HTTP " + response.getStatusLine().getStatusCode());
            }
            
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

    /**
     * Upload a Note object to IPFS (controller-compatible method)
     * @param note Note object to upload
     * @return IPFS CID (Content Identifier)
     * @throws IOException if upload fails
     */
    public String uploadNoteToIpfs(Note note) throws IOException {
        Map<String, String> metadata = new HashMap<>();
        metadata.put("id", String.valueOf(note.getId()));
        metadata.put("userId", String.valueOf(note.getUserId()));
        if (note.getTags() != null) {
            metadata.put("tags", note.getTags());
        }
        
        return uploadNote(note.getTitle(), note.getContent(), note.getMarkdownContent(), metadata);
    }

    /**
     * Retrieve content from IPFS as String (controller-compatible method)
     * @param cid IPFS Content Identifier
     * @return String content
     * @throws IOException if retrieval fails
     */
    public String retrieveContentFromIpfs(String cid) throws IOException {
        Map<String, Object> noteData = retrieveNote(cid);
        return objectMapper.writeValueAsString(noteData);
    }

    /**
     * Verify note integrity by comparing stored hash with calculated hash
     * @param note Note object to verify
     * @return true if note integrity is valid
     */
    public boolean verifyNoteIntegrity(Note note) {
        if (note.getContentHash() == null || note.getContentHash().isEmpty()) {
            logger.warn("Note {} has no content hash for verification", note.getId());
            return false;
        }

        try {
            String calculatedHash = calculateContentHash(note.getTitle(), note.getContent());
            boolean isValid = note.getContentHash().equals(calculatedHash);
            
            if (isValid) {
                logger.info("Note {} integrity verification passed", note.getId());
            } else {
                logger.warn("Note {} integrity verification failed. Expected: {}, Calculated: {}", 
                    note.getId(), note.getContentHash(), calculatedHash);
            }
            
            return isValid;
            
        } catch (Exception e) {
            logger.error("Error verifying note {} integrity: {}", note.getId(), e.getMessage());
            return false;
        }
    }
}

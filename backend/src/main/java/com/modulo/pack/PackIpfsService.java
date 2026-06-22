package com.modulo.pack;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.service.IpfsService;
import com.modulo.util.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * IPFS distribution layer for packs (#277).
 *
 * Publish: serialises the pack manifest JSON, uploads it to IPFS, stores the
 *          returned CID and a SHA-256 integrity hash back in plugin_registry.
 *
 * Install from CID: fetches raw content by CID, verifies the SHA-256 hash
 *                   (when supplied by the caller), parses as a PackManifest,
 *                   and delegates to PackService for the full validation chain.
 */
@Service
public class PackIpfsService {

    private static final Logger logger = LoggerFactory.getLogger(PackIpfsService.class);
    private static final String RUNTIME = "PACK";
    private static final String SOURCE_IPFS = "IPFS";

    @Autowired private IpfsService ipfsService;
    @Autowired private PackService packService;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Publish
    // -------------------------------------------------------------------------

    public record PublishResult(boolean ok, String reason, String cid, String contentHash, String gatewayUrl) {
        static PublishResult fail(String reason) {
            return new PublishResult(false, reason, null, null, null);
        }
        static PublishResult success(String cid, String hash, String gateway) {
            return new PublishResult(true, null, cid, hash, gateway);
        }
    }

    /**
     * Publish an installed pack to IPFS.
     * The manifest JSON already stored in plugin_registry is uploaded as-is so
     * the CID is a deterministic, content-addressed fingerprint of the manifest.
     */
    @Transactional
    public PublishResult publishToIpfs(String packId) {
        if (!ipfsService.isAvailable()) {
            return PublishResult.fail("IPFS node is not available");
        }

        // Load the raw manifest JSON from the registry
        String manifestJson;
        try {
            manifestJson = jdbc.queryForObject(
                "SELECT config::text FROM plugin_registry WHERE runtime = ? AND name = ?",
                String.class, RUNTIME, packId);
        } catch (Exception e) {
            return PublishResult.fail("Pack \"" + packId + "\" is not installed");
        }

        if (manifestJson == null || manifestJson.isBlank()) {
            return PublishResult.fail("Pack \"" + packId + "\" has no stored manifest");
        }

        // Compute SHA-256 over the canonical UTF-8 JSON bytes
        String contentHash = sha256Hex(manifestJson);

        // Upload the raw JSON to IPFS
        String cid;
        try {
            cid = ipfsService.uploadEncryptedContent(manifestJson);
        } catch (Exception e) {
            logger.error("IPFS upload failed for pack {}: {}", LogSanitizer.sanitize(packId),
                LogSanitizer.sanitizeMessage(e.getMessage()));
            return PublishResult.fail("IPFS upload failed: " + e.getMessage());
        }

        // Pin the content so it stays available
        ipfsService.pinContent(cid);

        // Persist CID and hash back to the registry row
        jdbc.update(
            "UPDATE plugin_registry SET ipfs_cid = ?, content_hash = ?, updated_at = ? " +
            "WHERE runtime = ? AND name = ?",
            cid, contentHash, LocalDateTime.now(), RUNTIME, packId
        );

        String gatewayUrl = ipfsService.getGatewayUrl(cid);
        logger.info("Pack {} published to IPFS: {} (hash={})", LogSanitizer.sanitize(packId),
            LogSanitizer.sanitizeCid(cid), contentHash);
        return PublishResult.success(cid, contentHash, gatewayUrl);
    }

    // -------------------------------------------------------------------------
    // Install from CID
    // -------------------------------------------------------------------------

    /**
     * Fetch a pack manifest by IPFS CID, optionally verify its SHA-256 hash,
     * and install it via PackService.
     *
     * @param cid          the IPFS CID to fetch
     * @param expectedHash optional SHA-256 hex digest for integrity verification
     */
    @Transactional
    public PackService.PackCheck installFromCid(String cid, String expectedHash) {
        if (!ipfsService.isAvailable()) {
            return PackService.PackCheck.fail("IPFS node is not available");
        }

        if (!ipfsService.isValidCid(cid)) {
            return PackService.PackCheck.fail("Invalid CID format: \"" + cid + "\"");
        }

        // Fetch raw manifest JSON from IPFS
        String manifestJson;
        try {
            manifestJson = ipfsService.retrieveRawContent(cid);
        } catch (Exception e) {
            logger.error("Failed to fetch CID {} from IPFS: {}", LogSanitizer.sanitizeCid(cid),
                LogSanitizer.sanitizeMessage(e.getMessage()));
            return PackService.PackCheck.fail("Failed to fetch from IPFS: " + e.getMessage());
        }

        // Integrity check
        if (expectedHash != null && !expectedHash.isBlank()) {
            String actualHash = sha256Hex(manifestJson);
            if (!actualHash.equalsIgnoreCase(expectedHash)) {
                logger.warn("Integrity check failed for CID {}: expected={} actual={}",
                    LogSanitizer.sanitizeCid(cid), expectedHash, actualHash);
                return PackService.PackCheck.fail(
                    "Integrity check failed: hash mismatch (expected " + expectedHash + ")");
            }
        }

        // Parse manifest
        PackManifest manifest;
        try {
            manifest = objectMapper.readValue(manifestJson, PackManifest.class);
        } catch (Exception e) {
            return PackService.PackCheck.fail("Failed to parse manifest from CID: " + e.getMessage());
        }

        // Delegate to PackService for full lifecycle validation + install
        PackService.PackCheck result = packService.install(manifest);
        if (!result.ok()) return result;

        // Stamp the installed record with its origin CID + hash
        String actualHash = sha256Hex(manifestJson);
        jdbc.update(
            "UPDATE plugin_registry SET ipfs_cid = ?, content_hash = ?, source = ?, updated_at = ? " +
            "WHERE runtime = ? AND name = ?",
            cid, actualHash, SOURCE_IPFS, LocalDateTime.now(), RUNTIME, manifest.getId()
        );

        logger.info("Pack {} installed from IPFS CID {}", LogSanitizer.sanitize(manifest.getId()),
            LogSanitizer.sanitizeCid(cid));
        return PackService.PackCheck.pass();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static String sha256Hex(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }
    }
}

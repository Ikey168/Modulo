package com.modulo.pack;

import com.modulo.util.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for the pack install/uninstall lifecycle and IPFS distribution (#276, #277).
 */
@RestController
@RequestMapping("/api/packs")
public class PackController {

    private static final Logger logger = LoggerFactory.getLogger(PackController.class);

    @Autowired private PackService packService;
    @Autowired private PackIpfsService packIpfsService;

    /** POST /api/packs/install — install or upgrade a pack from its manifest JSON. */
    @PostMapping("/install")
    public ResponseEntity<Map<String, Object>> install(@RequestBody PackManifest manifest) {
        PackService.PackCheck result = packService.install(manifest);
        if (result.ok()) {
            return ResponseEntity.ok(Map.of("ok", true));
        }
        logger.warn("Pack install rejected: {}", LogSanitizer.sanitize(result.reason()));
        return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", result.reason()));
    }

    /** POST /api/packs/install-from-cid — fetch a pack from IPFS by CID and install it. */
    @PostMapping("/install-from-cid")
    public ResponseEntity<Map<String, Object>> installFromCid(@RequestBody Map<String, String> body) {
        String cid = body.get("cid");
        if (cid == null || cid.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", "cid is required"));
        }
        String expectedHash = body.get("expectedHash");
        PackService.PackCheck result = packIpfsService.installFromCid(cid, expectedHash);
        if (result.ok()) {
            return ResponseEntity.ok(Map.of("ok", true));
        }
        logger.warn("Pack install-from-cid rejected ({}): {}", LogSanitizer.sanitizeCid(cid),
            LogSanitizer.sanitize(result.reason()));
        return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", result.reason()));
    }

    /** POST /api/packs/{packId}/publish — publish an installed pack to IPFS. */
    @PostMapping("/{packId}/publish")
    public ResponseEntity<Map<String, Object>> publish(@PathVariable String packId) {
        PackIpfsService.PublishResult result = packIpfsService.publishToIpfs(packId);
        if (result.ok()) {
            return ResponseEntity.ok(Map.of(
                "ok", true,
                "cid", result.cid(),
                "contentHash", result.contentHash(),
                "gatewayUrl", result.gatewayUrl()
            ));
        }
        logger.warn("Pack publish rejected for {}: {}", LogSanitizer.sanitize(packId),
            LogSanitizer.sanitize(result.reason()));
        return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", result.reason()));
    }

    /** DELETE /api/packs/{packId} — uninstall a pack. */
    @DeleteMapping("/{packId}")
    public ResponseEntity<Map<String, Object>> uninstall(@PathVariable String packId) {
        PackService.PackCheck result = packService.uninstall(packId);
        if (result.ok()) {
            return ResponseEntity.ok(Map.of("ok", true));
        }
        logger.warn("Pack uninstall rejected for {}: {}", LogSanitizer.sanitize(packId),
            LogSanitizer.sanitize(result.reason()));
        return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", result.reason()));
    }

    /** GET /api/packs — list all installed packs. */
    @GetMapping
    public ResponseEntity<List<PackEntry>> list() {
        return ResponseEntity.ok(packService.listPacks());
    }

    /** GET /api/packs/published — list packs that have been published to IPFS. */
    @GetMapping("/published")
    public ResponseEntity<List<PackEntry>> listPublished() {
        return ResponseEntity.ok(packService.listPublishedPacks());
    }

    /** GET /api/packs/{packId} — get a specific pack. */
    @GetMapping("/{packId}")
    public ResponseEntity<PackEntry> get(@PathVariable String packId) {
        return packService.getPack(packId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}

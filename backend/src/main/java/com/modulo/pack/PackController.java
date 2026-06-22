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
    @Autowired private PackProvenanceService packProvenanceService;

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
        String buyerAddress = body.get("buyerAddress");
        PackService.PackCheck result = packIpfsService.installFromCid(cid, expectedHash, buyerAddress);
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

    // -------------------------------------------------------------------------
    // On-chain provenance + paid packs (#278)
    // -------------------------------------------------------------------------

    /** POST /api/packs/{packId}/anchor — anchor the pack's hash on-chain for provenance. */
    @PostMapping("/{packId}/anchor")
    public ResponseEntity<Map<String, Object>> anchor(@PathVariable String packId) {
        PackProvenanceService.AnchorResult result = packProvenanceService.anchorPack(packId);
        if (result.ok()) {
            return ResponseEntity.ok(Map.of(
                "ok", true,
                "txHash", result.txHash(),
                "onchainId", result.onchainId() != null ? result.onchainId() : -1,
                "authorAddress", result.authorAddress(),
                "placeholder", result.placeholder()
            ));
        }
        logger.warn("Pack anchor rejected for {}: {}", LogSanitizer.sanitize(packId),
            LogSanitizer.sanitize(result.reason()));
        return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", result.reason()));
    }

    /** GET /api/packs/{packId}/provenance — fetch on-chain provenance info. */
    @GetMapping("/{packId}/provenance")
    public ResponseEntity<PackProvenanceService.ProvenanceInfo> provenance(@PathVariable String packId) {
        return packProvenanceService.getProvenance(packId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /** POST /api/packs/{packId}/pricing — set premium pricing + royalty for a paid pack. */
    @PostMapping("/{packId}/pricing")
    public ResponseEntity<Map<String, Object>> pricing(@PathVariable String packId,
                                                       @RequestBody Map<String, Object> body) {
        boolean premium = Boolean.TRUE.equals(body.get("premium"));
        String accessPrice = body.get("accessPrice") != null ? body.get("accessPrice").toString() : null;
        int royaltyBps = body.get("royaltyBps") instanceof Number
            ? ((Number) body.get("royaltyBps")).intValue() : 0;
        PackService.PackCheck result = packService.setPricing(packId, premium, accessPrice, royaltyBps);
        if (result.ok()) {
            return ResponseEntity.ok(Map.of("ok", true));
        }
        return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", result.reason()));
    }

    /** GET /api/packs/{packId}/entitlement?address=0x... — check whether an address may install. */
    @GetMapping("/{packId}/entitlement")
    public ResponseEntity<Map<String, Object>> entitlement(@PathVariable String packId,
                                                           @RequestParam(required = false) String address) {
        if (packService.getPack(packId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        boolean entitled = packProvenanceService.hasEntitlement(packId, address);
        return ResponseEntity.ok(Map.of("ok", true, "entitled", entitled));
    }
}

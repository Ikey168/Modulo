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
 * REST endpoints for the pack install/uninstall lifecycle (#276).
 */
@RestController
@RequestMapping("/api/packs")
public class PackController {

    private static final Logger logger = LoggerFactory.getLogger(PackController.class);

    @Autowired private PackService packService;

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

    /** DELETE /api/packs/{packId} — uninstall a pack. */
    @DeleteMapping("/{packId}")
    public ResponseEntity<Map<String, Object>> uninstall(@PathVariable String packId) {
        PackService.PackCheck result = packService.uninstall(packId);
        if (result.ok()) {
            return ResponseEntity.ok(Map.of("ok", true));
        }
        logger.warn("Pack uninstall rejected for {}: {}", LogSanitizer.sanitize(packId), LogSanitizer.sanitize(result.reason()));
        return ResponseEntity.badRequest().body(Map.of("ok", false, "reason", result.reason()));
    }

    /** GET /api/packs — list all installed packs. */
    @GetMapping
    public ResponseEntity<List<PackEntry>> list() {
        return ResponseEntity.ok(packService.listPacks());
    }

    /** GET /api/packs/{packId} — get a specific pack. */
    @GetMapping("/{packId}")
    public ResponseEntity<PackEntry> get(@PathVariable String packId) {
        return packService.getPack(packId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}

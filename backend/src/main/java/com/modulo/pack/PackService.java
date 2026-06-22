package com.modulo.pack;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.BlueprintCapabilityService;
import com.modulo.blueprint.interpreter.BlueprintIRGraph;
import com.modulo.util.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Pack install/uninstall lifecycle service (#276).
 *
 * Packs are stored in plugin_registry (runtime = 'PACK') and their contributed
 * nodes/blueprints are tracked in pack_contributions. The in-memory registry
 * is rebuilt on startup from the persisted records.
 */
@Service
public class PackService {

    private static final Logger logger = LoggerFactory.getLogger(PackService.class);
    private static final String RUNTIME = "PACK";
    private static final String TYPE = "INTERNAL";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final int CURRENT_IR_VERSION = 1;

    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private BlueprintCapabilityService capabilityService;

    // In-memory registry: packId -> version
    private final Map<String, SemVer> installedVersions = new ConcurrentHashMap<>();

    // -------------------------------------------------------------------------
    // Startup: reload installed packs
    // -------------------------------------------------------------------------

    @PostConstruct
    public void loadInstalledPacks() {
        jdbc.query(
            "SELECT name, version FROM plugin_registry WHERE runtime = ? AND status = ?",
            rs -> {
                String packId = rs.getString("name");
                SemVer v = SemVer.parse(rs.getString("version"));
                if (v != null) installedVersions.put(packId, v);
            },
            RUNTIME, STATUS_ACTIVE
        );
        logger.info("Pack registry: {} pack(s) loaded on startup", installedVersions.size());
    }

    // -------------------------------------------------------------------------
    // Validation helpers
    // -------------------------------------------------------------------------

    public record PackCheck(boolean ok, String reason) {
        static PackCheck pass() { return new PackCheck(true, null); }
        static PackCheck fail(String reason) { return new PackCheck(false, reason); }
    }

    private PackCheck validateManifest(PackManifest m) {
        if (m.getId() == null || m.getId().isBlank()) return PackCheck.fail("manifest.id is required");
        if (m.getName() == null || m.getName().isBlank()) return PackCheck.fail("manifest.name is required");
        if (m.getVersion() == null) return PackCheck.fail("manifest.version is required");
        if (SemVer.parse(m.getVersion()) == null) {
            return PackCheck.fail("manifest.version \"" + m.getVersion() + "\" is not a valid semver");
        }
        if (m.getMinCatalogVersion() != null && SemVer.parse(m.getMinCatalogVersion()) == null) {
            return PackCheck.fail("manifest.minCatalogVersion \"" + m.getMinCatalogVersion() + "\" is not a valid semver");
        }
        for (PackManifest.PackDependency dep : m.getDependencies()) {
            if (dep.getId() == null || dep.getId().isBlank()) return PackCheck.fail("Dependency id is required");
            if (SemVer.parse(dep.getMinVersion()) == null) {
                return PackCheck.fail("Dependency \"" + dep.getId() + "\" minVersion \"" + dep.getMinVersion() + "\" is not a valid semver");
            }
        }
        return PackCheck.pass();
    }

    private PackCheck checkCompatibility(PackManifest m) {
        if (m.getMinCatalogVersion() != null) {
            SemVer minCat = SemVer.parseOrThrow(m.getMinCatalogVersion());
            SemVer installed = SemVer.parseOrThrow(SemVer.CATALOG_VERSION);
            if (!installed.satisfiesMin(minCat)) {
                return PackCheck.fail("Pack \"" + m.getId() + "\" requires catalog >= " + m.getMinCatalogVersion()
                    + ", but installed catalog is " + SemVer.CATALOG_VERSION);
            }
        }
        if (m.getMinIrVersion() != null && CURRENT_IR_VERSION < m.getMinIrVersion()) {
            return PackCheck.fail("Pack \"" + m.getId() + "\" requires IR version >= " + m.getMinIrVersion()
                + ", but runtime IR version is " + CURRENT_IR_VERSION);
        }
        return PackCheck.pass();
    }

    private PackCheck checkDependencies(PackManifest m) {
        for (PackManifest.PackDependency dep : m.getDependencies()) {
            SemVer installed = installedVersions.get(dep.getId());
            if (installed == null) {
                return PackCheck.fail("Missing dependency: pack \"" + dep.getId() + "\" is not installed");
            }
            SemVer min = SemVer.parseOrThrow(dep.getMinVersion());
            if (!installed.satisfiesMin(min)) {
                return PackCheck.fail("Dependency \"" + dep.getId() + "\" requires >= " + dep.getMinVersion()
                    + ", but " + installed + " is installed");
            }
        }
        return PackCheck.pass();
    }

    private PackCheck checkVersionConflict(PackManifest m) {
        SemVer existing = installedVersions.get(m.getId());
        if (existing != null) {
            SemVer incoming = SemVer.parseOrThrow(m.getVersion());
            if (existing.compareTo(incoming) >= 0) {
                return PackCheck.fail("Pack \"" + m.getId() + "\" version " + existing
                    + " is already installed (new: " + m.getVersion() + ")");
            }
        }
        return PackCheck.pass();
    }

    // -------------------------------------------------------------------------
    // Install
    // -------------------------------------------------------------------------

    @Transactional
    public PackCheck install(PackManifest manifest) {
        PackCheck c;

        c = validateManifest(manifest); if (!c.ok()) return c;
        c = checkCompatibility(manifest); if (!c.ok()) return c;
        c = checkDependencies(manifest); if (!c.ok()) return c;
        c = checkVersionConflict(manifest); if (!c.ok()) return c;

        String manifestJson = toJson(manifest);
        LocalDateTime now = LocalDateTime.now();
        boolean isUpgrade = installedVersions.containsKey(manifest.getId());

        Long registryId;
        if (isUpgrade) {
            // Update existing record
            jdbc.update(
                "UPDATE plugin_registry SET version = ?, description = ?, config = ?::jsonb, status = ?, updated_at = ? " +
                "WHERE runtime = ? AND name = ?",
                manifest.getVersion(),
                manifest.getDescription(),
                manifestJson,
                STATUS_ACTIVE,
                now,
                RUNTIME,
                manifest.getId()
            );
            registryId = jdbc.queryForObject(
                "SELECT id FROM plugin_registry WHERE runtime = ? AND name = ?",
                Long.class, RUNTIME, manifest.getId()
            );
            // Clear old contributions before re-recording
            jdbc.update("DELETE FROM pack_contributions WHERE pack_id = ?", registryId);
        } else {
            // Insert new record
            registryId = jdbc.queryForObject(
                "INSERT INTO plugin_registry (name, version, description, author, type, runtime, status, config, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id",
                Long.class,
                manifest.getId(),
                manifest.getVersion(),
                manifest.getDescription(),
                manifest.getAuthor(),
                TYPE,
                RUNTIME,
                STATUS_ACTIVE,
                manifestJson,
                now,
                now
            );
        }

        // Record contributed nodes
        for (Map<String, Object> node : manifest.getContributes().getNodes()) {
            String type = (String) node.get("type");
            Object ver = node.get("version");
            int nodeVersion = ver instanceof Number ? ((Number) ver).intValue() : 1;
            jdbc.update(
                "INSERT INTO pack_contributions (pack_id, kind, type_or_name, version, created_at) VALUES (?, 'node', ?, ?, ?) " +
                "ON CONFLICT (pack_id, kind, type_or_name, version) DO NOTHING",
                registryId, type, nodeVersion, now
            );
        }

        // Record contributed blueprints and sync their capabilities
        for (Map<String, Object> bp : manifest.getContributes().getBlueprints()) {
            String bpName = extractBlueprintName(bp);
            jdbc.update(
                "INSERT INTO pack_contributions (pack_id, kind, type_or_name, version, created_at) VALUES (?, 'blueprint', ?, 1, ?) " +
                "ON CONFLICT (pack_id, kind, type_or_name, version) DO NOTHING",
                registryId, bpName, now
            );
        }

        // Sync capability grants for the pack (initially ungrated)
        List<String> caps = deriveCaps(manifest);
        capabilityService.syncPermissions(registryId, new LinkedHashSet<>(caps));

        // Update in-memory registry
        installedVersions.put(manifest.getId(), SemVer.parseOrThrow(manifest.getVersion()));

        logger.info("Pack installed: {} v{} (registry id {})", manifest.getId(), manifest.getVersion(), registryId);
        return PackCheck.pass();
    }

    // -------------------------------------------------------------------------
    // Uninstall
    // -------------------------------------------------------------------------

    @Transactional
    public PackCheck uninstall(String packId) {
        if (!installedVersions.containsKey(packId)) {
            return PackCheck.fail("Pack \"" + packId + "\" is not installed");
        }

        // Reject if another installed pack depends on this one
        List<String> dependents = findDependents(packId);
        if (!dependents.isEmpty()) {
            return PackCheck.fail("Cannot uninstall \"" + packId + "\": pack(s) " + dependents + " depend on it");
        }

        jdbc.update(
            "DELETE FROM plugin_registry WHERE runtime = ? AND name = ?",
            RUNTIME, packId
        );

        installedVersions.remove(packId);
        logger.info("Pack uninstalled: {}", packId);
        return PackCheck.pass();
    }

    // -------------------------------------------------------------------------
    // Query
    // -------------------------------------------------------------------------

    public List<PackEntry> listPacks() {
        return jdbc.query(
            "SELECT id, name, version, description, status, config::text, created_at, updated_at " +
            "FROM plugin_registry WHERE runtime = ? ORDER BY created_at",
            (rs, i) -> {
                PackEntry e = new PackEntry();
                e.setId(rs.getLong("id"));
                e.setPackId(rs.getString("name"));
                e.setVersion(rs.getString("version"));
                e.setName(rs.getString("name"));
                e.setDescription(rs.getString("description"));
                e.setStatus(rs.getString("status"));
                e.setManifest(parseManifest(rs.getString("config")));
                e.setInstalledAt(rs.getTimestamp("created_at").toLocalDateTime().toString());
                e.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime().toString());
                return e;
            },
            RUNTIME
        );
    }

    public Optional<PackEntry> getPack(String packId) {
        try {
            PackEntry e = jdbc.queryForObject(
                "SELECT id, name, version, description, status, config::text, created_at, updated_at " +
                "FROM plugin_registry WHERE runtime = ? AND name = ?",
                (rs, i) -> {
                    PackEntry entry = new PackEntry();
                    entry.setId(rs.getLong("id"));
                    entry.setPackId(rs.getString("name"));
                    entry.setVersion(rs.getString("version"));
                    entry.setName(rs.getString("name"));
                    entry.setDescription(rs.getString("description"));
                    entry.setStatus(rs.getString("status"));
                    entry.setManifest(parseManifest(rs.getString("config")));
                    entry.setInstalledAt(rs.getTimestamp("created_at").toLocalDateTime().toString());
                    entry.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime().toString());
                    return entry;
                },
                RUNTIME, packId
            );
            return Optional.ofNullable(e);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private List<String> findDependents(String packId) {
        // Query manifests of all installed packs and check their dependency lists.
        return jdbc.query(
            "SELECT name, config::text FROM plugin_registry WHERE runtime = ? AND status = ?",
            (rs, i) -> {
                String name = rs.getString("name");
                PackManifest m = parseManifest(rs.getString("config"));
                if (m != null && m.getDependencies().stream().anyMatch(d -> packId.equals(d.getId()))) {
                    return name;
                }
                return null;
            },
            RUNTIME, STATUS_ACTIVE
        ).stream().filter(Objects::nonNull).collect(Collectors.toList());
    }

    private List<String> deriveCaps(PackManifest manifest) {
        Set<String> caps = new LinkedHashSet<>(manifest.getCapabilities());
        for (Map<String, Object> node : manifest.getContributes().getNodes()) {
            Object cap = node.get("capability");
            if (cap instanceof String) caps.add((String) cap);
        }
        return new ArrayList<>(caps);
    }

    @SuppressWarnings("unchecked")
    private String extractBlueprintName(Map<String, Object> bp) {
        Object meta = bp.get("metadata");
        if (meta instanceof Map) {
            Object name = ((Map<String, Object>) meta).get("name");
            if (name instanceof String) return (String) name;
        }
        return "unnamed-blueprint";
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return "{}"; }
    }

    private PackManifest parseManifest(String json) {
        if (json == null || json.isBlank()) return null;
        try { return objectMapper.readValue(json, PackManifest.class); } catch (Exception e) { return null; }
    }
}
